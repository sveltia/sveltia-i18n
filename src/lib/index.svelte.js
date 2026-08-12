import { MessageFormat } from 'messageformat';
import { DefaultFunctions, DraftFunctions } from 'messageformat/functions';
import { SvelteMap, SvelteURLSearchParams } from 'svelte/reactivity';

// Polyfill
Intl.MessageFormat ??= MessageFormat;

/**
 * A date/time format preset, extending `Intl.DateTimeFormatOptions` with a `locale` override that
 * applies whenever the preset is selected.
 * @typedef {Intl.DateTimeFormatOptions & { locale?: string }} DateFormatPreset
 */

/**
 * A number format preset, extending `Intl.NumberFormatOptions` with a `locale` override that
 * applies whenever the preset is selected.
 * @typedef {Intl.NumberFormatOptions & { locale?: string }} NumberFormatPreset
 */

/**
 * Custom format presets. Within each group, the reserved `_default` key defines the preset used
 * when no `format` option is given, replacing the bare `Intl` defaults. It also applies to the
 * matching MF2 placeholders in messages, where it likewise replaces the options the placeholder
 * resolved. Any other key defines a named preset selectable with the `format` option.
 * @typedef {object} Formats
 * @property {Record<string, NumberFormatPreset>} [number] Custom number format presets.
 * @property {Record<string, DateFormatPreset>} [date] Custom date format presets.
 * @property {Record<string, DateFormatPreset>} [time] Custom time format presets.
 * @property {Record<string, DateFormatPreset>} [datetime] Custom date/time format presets. Used
 * only by the MF2 `:datetime` function; there is no standalone `datetime()` formatter.
 */

/**
 * Per-call format overrides for the MF2 placeholders in a single message. Each entry is either the
 * name of a preset (custom or built-in) or an inline preset object.
 * @typedef {object} MessageFormats
 * @property {string | NumberFormatPreset} [number] Applied to `:number` and `:integer`.
 * @property {string | DateFormatPreset} [date] Applied to `:date`.
 * @property {string | DateFormatPreset} [time] Applied to `:time`.
 * @property {string | DateFormatPreset} [datetime] Applied to `:datetime`.
 */

/**
 * A custom MF2 function handler, registered with `registerMessageFunction()` and callable from
 * messages as `:name`.
 * @callback MessageFunction
 * @param {any} context MF2 function context, carrying `locales`, `localeMatcher` and `onError`.
 * @param {Record<string, unknown>} options Options given in the message expression, e.g.
 * `weekday=long`.
 * @param {unknown} [operand] The value the function was applied to.
 * @returns {any} A message value exposing at least `toString()`.
 * @see https://messageformat.github.io/messageformat/api/messageformat.messagefunction/
 */

/**
 * @callback MissingKeyHandler
 * @param {string} key The missing message key.
 * @param {string} locale The active locale.
 * @param {string | undefined} defaultValue The default value passed to `format()`, if any.
 * @returns {string | void} A replacement string, or `undefined` to fall through to the default.
 */

/**
 * @typedef {object} MessageObject
 * @property {string} id Message key.
 * @property {Record<string, any>} [values] Variables to interpolate into the message.
 * @property {string} [locale] Locale override for this call.
 * @property {string} [default] Fallback string if the key is not found.
 * @property {MessageFormats} [formats] Format overrides for the MF2 placeholders in this message.
 */

/**
 * Date/time formatting options, extending `Intl.DateTimeFormatOptions` with `locale` and `format`
 * overrides.
 * @typedef {Intl.DateTimeFormatOptions & { locale?: string, format?: string }} DateFormatOptions
 */

/**
 * Number formatting options, extending `Intl.NumberFormatOptions` with `locale` and `format`
 * overrides.
 * @typedef {Intl.NumberFormatOptions & { locale?: string, format?: string }} NumberFormatOptions
 */

// --- State ---

/** @type {string} */
let _locale = $state('');
/**
 * All registered locales.
 * @type {string[]}
 */
const locales = $state([]);
/**
 * All registered resources.
 * @type {Record<string, Record<string, Intl.MessageFormat>>}
 */
const dictionary = $state({});
/**
 * Whether locale messages are currently being loaded. Returns `true` after a locale is set but
 * before its messages are available.
 * @returns {boolean} `true` if messages are pending for the current locale, `false` otherwise.
 */
const isLoading = () => !!_locale && !dictionary[_locale];

// --- Configuration state ---

/** Locale to fall back to when the active locale has no entry for a key. */
// eslint-disable-next-line padding-line-between-statements
let fallbackLocale = '';
/**
 * Negotiated fallback locale — pre-computed from `fallbackLocale` against the registered locales.
 * Cached to avoid repeated `Intl.Locale` construction on every `format()` call.
 */
let _resolvedFallback = '';
/** @type {MissingKeyHandler | undefined} */
let missingMessageHandler;
/** @type {Formats} */
let customFormats = {};
/**
 * Custom MF2 functions, keyed by the name used in messages. Read when a message is compiled, so
 * entries added after `addMessages()` do not apply to messages already registered.
 * @type {Record<string, MessageFunction>}
 */
let customFunctions = {};
/**
 * Format overrides for the MF2 placeholders of the message currently being formatted. MF2
 * formatting is synchronous, so this is set for the duration of one {@link format} call and cleared
 * again before it returns.
 * @type {MessageFormats | undefined}
 */
let messageFormats;

// Languages written right-to-left; used as a fallback when Intl.Locale.textInfo is not available
// (e.g. Firefox).
const RTL_LANGS = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'ha',
  'he',
  'khw',
  'ks',
  'ku',
  'nqo',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

/**
 * Return the text direction for a resolved `Intl.Locale` object. Uses `textInfo.direction` when
 * available (Chrome/Safari) and falls back to the `RTL_LANGS` set (Firefox).
 * @param {Intl.Locale} localeObj The locale object to inspect.
 * @returns {'ltr' | 'rtl'} The text direction of the locale.
 */
const getTextDirection = (localeObj) => {
  /* v8 ignore next */
  const dir = /** @type {any} */ (localeObj).textInfo?.direction;

  /* v8 ignore next */
  return dir ?? (RTL_LANGS.has(localeObj.language) ? 'rtl' : 'ltr');
};

/**
 * Whether the given locale (or the current locale if omitted) is written right-to-left. Reactive:
 * re-evaluates automatically whenever the locale changes.
 * @param {string} [localeCode] Locale to check. Defaults to the active locale.
 * @returns {boolean} `true` if the locale is RTL, `false` otherwise.
 */
const isRTL = (localeCode = _locale) => {
  if (!localeCode) return false;

  try {
    return getTextDirection(new Intl.Locale(localeCode)) === 'rtl';
  } catch {
    return false;
  }
};

// --- Messages ---

/**
 * Negotiate the best available locale for a requested tag.
 * 1. Exact match  2. Same language subtag (e.g. En-CA → en-US)  3. Original value.
 * @param {string} requested The requested locale tag.
 * @param {string[]} available List of available locale codes.
 * @returns {string} The best-matching available locale, or `requested` if no match is found.
 */
const negotiateLocale = (requested, available) => {
  if (!requested || !available.length) return requested;
  if (available.includes(requested)) return requested;

  try {
    const lang = new Intl.Locale(requested).language;

    return (
      available.find((l) => {
        try {
          return new Intl.Locale(l).language === lang;
        } catch {
          return false;
        }
      }) ?? requested
    );
  } catch {
    return requested;
  }
};

/**
 * Recursively flatten a nested message map into dot-separated keys. `{ field: { name: 'Name' } }` →
 * `{ 'field.name': 'Name' }` Top-level keys that already contain dots are preserved as-is.
 * @param {Record<string, any>} map Nested or flat message map to flatten.
 * @param {string} [prefix] Key prefix for recursive calls.
 * @returns {Record<string, string>} Flat map with dot-separated keys.
 */
const flattenMessages = (map, prefix = '') =>
  Object.entries(map).reduce((acc, [key, value]) => {
    const flatKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flattenMessages(value, flatKey));
    } else {
      acc[flatKey] = value;
    }

    return acc;
  }, /** @type {Record<string, string>} */ (Object.create(null)));

/**
 * Register a locale code in `locales` (if not already present) and refresh `_resolvedFallback`.
 * Shared by {@link addMessages} and {@link register}.
 * @param {string} localeCode Locale code to register.
 */
const registerLocaleCode = (localeCode) => {
  if (!locales.includes(localeCode)) {
    locales.push(localeCode);
    _resolvedFallback = negotiateLocale(fallbackLocale, locales);
  }
};

/**
 * Add new messages for a locale. Accepts flat or nested maps; nested objects are flattened to
 * dot-separated keys (`field.name`). Multiple dicts can be passed and are merged in order, matching
 * svelte-i18n’s `addMessages(locale, ...dicts)` signature.
 * @param {string} localeCode Locale.
 * @param {...Record<string, any>} maps One or more message maps (flat or nested).
 * @throws {TypeError} If `localeCode` is not a non-empty string or any map is not a plain object.
 * @see https://messageformat.github.io/messageformat/api/messageformat.messageformat/
 */
const addMessages = (localeCode, ...maps) => {
  if (typeof localeCode !== 'string' || !localeCode) {
    throw new TypeError(
      `addMessages: localeCode must be a non-empty string (got ${JSON.stringify(localeCode)})`,
    );
  }

  maps.forEach((map, i) => {
    if (map === null || typeof map !== 'object' || Array.isArray(map)) {
      throw new TypeError(
        `addMessages: maps[${i}] must be a plain object (got ${Array.isArray(map) ? 'array' : typeof map})`,
      );
    }
  });

  registerLocaleCode(localeCode);
  dictionary[localeCode] ??= {};

  maps.forEach((map) => {
    Object.entries(flattenMessages(map)).forEach(([key, value]) => {
      dictionary[localeCode][key] = new Intl.MessageFormat(localeCode, String(value), {
        // Custom functions come last so they can replace a built-in of the same name.
        // eslint-disable-next-line no-use-before-define
        functions: { ...MESSAGE_FUNCTIONS, ...customFunctions },
      });
    });
  });

  // Re-negotiate if locale.set() was called before any locales were registered.
  if (_locale && !locales.includes(_locale)) {
    // eslint-disable-next-line no-use-before-define
    locale.set(_locale);
  }
};

// --- Loader ---

/** @type {SvelteMap<string, () => Promise<Record<string, string>>>} */
const loaderQueue = new SvelteMap();
/** @type {SvelteMap<string, Promise<void>>} */
const loaderPromises = new SvelteMap();

/**
 * Execute the registered loader for the given locale (or the current locale if omitted) and wait
 * until the messages are loaded. Subsequent calls for the same locale return the same promise.
 * @param {string} [localeCode] Defaults to `locale.current`.
 * @returns {Promise<void>}
 * @throws {TypeError} If `localeCode` is provided and is not a string.
 */
const waitLocale = (localeCode = _locale) => {
  if (typeof localeCode !== 'string') {
    throw new TypeError(`waitLocale: localeCode must be a string (got ${typeof localeCode})`);
  }

  if (!localeCode) return Promise.resolve();

  if (!loaderPromises.has(localeCode)) {
    const loader = loaderQueue.get(localeCode);

    if (loader) {
      const promise = Promise.resolve(loader()).then(
        (map) => {
          addMessages(localeCode, map);
        },
        () => {
          loaderPromises.delete(localeCode);

          // If the failed `locale` is still the active one and has no `dictionary` entry, fall back
          // so that `isLoading()` does not remain `true` forever.
          if (_locale === localeCode && !dictionary[localeCode] && _resolvedFallback) {
            _locale = _resolvedFallback;
          }
        },
      );

      loaderPromises.set(localeCode, promise);
    } else {
      loaderPromises.set(localeCode, Promise.resolve());
    }
  }

  /* v8 ignore next */
  return loaderPromises.get(localeCode) ?? Promise.resolve();
};

// --- Locale ---

/**
 * Current locale.
 */
const locale = {
  /**
   * Returns the current locale code.
   * @returns {string} The active locale code.
   */
  get current() {
    return _locale;
  },
  /**
   * Set the current locale. Negotiates against registered locales (e.g. En-CA → en-US), updates
   * `<html lang>` / `<html dir>`, and auto-triggers any registered loader.
   * @param {string} value The locale to set.
   * @returns {Promise<void>}
   * @throws {TypeError} If `value` is not a string.
   */
  set(value) {
    if (typeof value !== 'string') {
      throw new TypeError(`locale.set: value must be a string (got ${typeof value})`);
    }

    let resolved = locales.length ? negotiateLocale(value, locales) : value;

    // If no registered locale matched, fall back to `fallbackLocale` (only when it actually
    // resolved to a registered locale; otherwise keep the original value).
    if (
      value &&
      locales.length &&
      !locales.includes(resolved) &&
      _resolvedFallback &&
      locales.includes(_resolvedFallback)
    ) {
      resolved = _resolvedFallback;
    }

    _locale = resolved;

    if (typeof document !== 'undefined' && resolved) {
      document.documentElement.lang = resolved;

      try {
        const localeObj = new Intl.Locale(resolved);

        document.documentElement.dir = getTextDirection(localeObj);
      } catch {
        // resolved is not a valid BCP 47 tag; skip dir update
      }
    }

    return waitLocale(resolved);
  },
};

/**
 * Register a custom MF2 function, callable from messages as `:name`. Registering an existing name,
 * including a built-in like `date`, replaces it.
 *
 * Messages are compiled by {@link addMessages}, which captures the functions available at that
 * moment, so **all functions must be registered before the messages that use them are added**. A
 * message referencing an unregistered function formats as a fallback such as `{$value}`.
 * @param {string} name Function name, without the leading colon.
 * @param {MessageFunction} fn Function handler.
 * @throws {TypeError} If `name` is not a non-empty string or `fn` is not a function.
 * @see https://messageformat.github.io/messageformat/api/messageformat.messagefunction/
 */
const registerMessageFunction = (name, fn) => {
  if (typeof name !== 'string' || !name) {
    throw new TypeError(
      `registerMessageFunction: name must be a non-empty string (got ${JSON.stringify(name)})`,
    );
  }

  if (typeof fn !== 'function') {
    throw new TypeError(`registerMessageFunction: fn must be a function (got ${typeof fn})`);
  }

  customFunctions[name] = fn;
};

/**
 * Register an async loader for a locale. The loader is called the first time
 * `waitLocale(localeCode)` is invoked for that locale.
 * @param {string} localeCode Locale.
 * @param {() => Promise<Record<string, string>>} loader Function returning a message map.
 * @throws {TypeError} If `localeCode` is not a non-empty string or `loader` is not a function.
 */
const register = (localeCode, loader) => {
  if (typeof localeCode !== 'string' || !localeCode) {
    throw new TypeError(
      `register: localeCode must be a non-empty string (got ${JSON.stringify(localeCode)})`,
    );
  }

  if (typeof loader !== 'function') {
    throw new TypeError(`register: loader must be a function (got ${typeof loader})`);
  }

  loaderQueue.set(localeCode, loader);
  // Invalidate any cached promise so the new loader is picked up on next waitLocale call.
  loaderPromises.delete(localeCode);

  registerLocaleCode(localeCode);

  // Re-negotiate if locale.set() was called before any locales were registered.
  if (_locale && !locales.includes(_locale)) {
    locale.set(_locale);
  }
};

/**
 * Get the user’s preferred locale from the browser.
 * @returns {string | undefined} The first navigator language, or `undefined` in non-browser
 * environments.
 */
const getLocaleFromNavigator = () =>
  typeof navigator === 'undefined' ? undefined : (navigator.languages?.[0] ?? navigator.language);

/**
 * Get the locale from a pattern matched against `window.location.hostname`.
 * @param {RegExp} hostnamePattern Pattern with a capture group for the locale code.
 * @returns {string | undefined} The matched locale code, or `undefined` if not in a browser or no
 * match.
 * @throws {TypeError} If `hostnamePattern` is not a `RegExp`.
 */
const getLocaleFromHostname = (hostnamePattern) => {
  if (!(hostnamePattern instanceof RegExp)) {
    throw new TypeError(
      `getLocaleFromHostname: hostnamePattern must be a RegExp (got ${typeof hostnamePattern})`,
    );
  }

  return typeof window === 'undefined' || !window.location
    ? undefined
    : window.location.hostname.match(hostnamePattern)?.[1];
};

/**
 * Get the locale from a pattern matched against `window.location.pathname`.
 * @param {RegExp} pathnamePattern Pattern with a capture group for the locale code.
 * @returns {string | undefined} The matched locale code, or `undefined` if not in a browser or no
 * match.
 * @throws {TypeError} If `pathnamePattern` is not a `RegExp`.
 */
const getLocaleFromPathname = (pathnamePattern) => {
  if (!(pathnamePattern instanceof RegExp)) {
    throw new TypeError(
      `getLocaleFromPathname: pathnamePattern must be a RegExp (got ${typeof pathnamePattern})`,
    );
  }

  return typeof window === 'undefined' || !window.location
    ? undefined
    : window.location.pathname.match(pathnamePattern)?.[1];
};

/**
 * Get the locale from a URL query string parameter.
 * @param {string} queryKey The query string key to read.
 * @returns {string | undefined} The query parameter value, or `undefined` if not in a browser or
 * not found.
 * @throws {TypeError} If `queryKey` is not a non-empty string.
 */
const getLocaleFromQueryString = (queryKey) => {
  if (typeof queryKey !== 'string' || !queryKey) {
    throw new TypeError(
      // eslint-disable-next-line max-len
      `getLocaleFromQueryString: queryKey must be a non-empty string (got ${JSON.stringify(queryKey)})`,
    );
  }

  return typeof window === 'undefined' || !window.location
    ? undefined
    : (new SvelteURLSearchParams(window.location.search).get(queryKey) ?? undefined);
};

/**
 * Get the locale from a `key=value` pair in `window.location.hash`.
 * @param {string} hashKey The key to look for in the hash.
 * @returns {string | undefined} The hash parameter value, or `undefined` if not in a browser or not
 * found.
 * @throws {TypeError} If `hashKey` is not a non-empty string.
 */
const getLocaleFromHash = (hashKey) => {
  if (typeof hashKey !== 'string' || !hashKey) {
    throw new TypeError(
      `getLocaleFromHash: hashKey must be a non-empty string (got ${JSON.stringify(hashKey)})`,
    );
  }

  if (typeof window === 'undefined' || !window.location) return undefined;

  const params = new SvelteURLSearchParams(window.location.hash.replace(/^#/, ''));

  return params.get(hashKey) ?? undefined;
};

// --- Configuration ---

/**
 * Initialize the locales.
 * @param {object} args Arguments.
 * @param {string} args.fallbackLocale Locale to be used for fallback.
 * @param {string} [args.initialLocale] Locale to be used for the initial selection.
 * @param {Formats} [args.formats] Custom named formats. The reserved `_default` key in each group
 * defines the preset used when a `number()`, `date()` or `time()` call passes no `format` option,
 * and for the matching MF2 placeholders in messages. A preset may carry a `locale` to format in a
 * locale other than the active one.
 * @param {MissingKeyHandler} [args.handleMissingMessage] Called when a message key is not found.
 * May return a string to use as a fallback.
 * @throws {TypeError} If `args.fallbackLocale` is not a string, `args.initialLocale` is not a
 * string, or `args.handleMissingMessage` is not a function.
 */
const init = (args) => {
  if (!args || typeof args.fallbackLocale !== 'string') {
    throw new TypeError(
      `init: fallbackLocale must be a string (got ${JSON.stringify(args?.fallbackLocale)})`,
    );
  }

  if (args.initialLocale !== undefined && typeof args.initialLocale !== 'string') {
    throw new TypeError(`init: initialLocale must be a string (got ${typeof args.initialLocale})`);
  }

  if (args.handleMissingMessage !== undefined && typeof args.handleMissingMessage !== 'function') {
    throw new TypeError(
      `init: handleMissingMessage must be a function (got ${typeof args.handleMissingMessage})`,
    );
  }

  fallbackLocale = args.fallbackLocale;
  _resolvedFallback = negotiateLocale(fallbackLocale, locales);
  missingMessageHandler = args.handleMissingMessage;
  customFormats = args.formats ?? {};
  if (args.initialLocale) locale.set(args.initialLocale);
};

// --- Formatting ---

/**
 * Format a message by key.
 *
 * Supports two call signatures (matching svelte-i18n):
 * - `format(id, options?)` — key as first argument
 * - `format({ id, values, locale, default })` — options object only.
 * @param {string | MessageObject} key Message key, or an object with `id` and options.
 * @param {{ values?: Record<string, any>, locale?: string, default?: string,
 * formats?: MessageFormats }} [options] Formatting options when `key` is a string.
 * @returns {string} The formatted message string.
 * @throws {TypeError} If `key` is `null` or `undefined`.
 */
const format = (
  key,
  { values = {}, locale: localeOverride, default: defaultString, formats } = {},
) => {
  if (key === null || key === undefined) {
    throw new TypeError(
      `format: key must be a string or message object (got ${JSON.stringify(key)})`,
    );
  }

  if (typeof key === 'object') {
    const { id, values: v = {}, locale: l, default: d, formats: f } = key;

    return format(id, { values: v, locale: l, default: d, formats: f });
  }

  const active = localeOverride ?? _locale;
  const fallback = _resolvedFallback;

  messageFormats = formats;

  /** @type {string | undefined} */
  let result;

  try {
    result =
      dictionary[active]?.[key]?.format(values) ??
      (active !== fallback ? dictionary[fallback]?.[key]?.format(values) : undefined);
  } finally {
    messageFormats = undefined;
  }

  if (result !== undefined) return result;

  if (missingMessageHandler) {
    const handled = missingMessageHandler(key, active, defaultString);

    if (handled !== undefined) return handled;
  }

  return defaultString ?? key;
};

/**
 * Return a nested object of formatted strings for all keys under the given prefix. Equivalent to
 * svelte-i18n’s `$json()`. Useful for iterating over a group of messages.
 * @param {string} prefix Key prefix (e.g. `'nav'` matches `nav.home`, `nav.about`, …).
 * @param {{ locale?: string }} [options] Lookup options.
 * @returns {Record<string, string> | undefined} Object mapping suffix keys to formatted strings, or
 * `undefined` if no keys match the prefix.
 * @throws {TypeError} If `prefix` is not a non-empty string.
 */
const json = (prefix, { locale: localeOverride } = {}) => {
  if (typeof prefix !== 'string' || !prefix) {
    throw new TypeError(`json: prefix must be a non-empty string (got ${JSON.stringify(prefix)})`);
  }

  const active = localeOverride ?? _locale;
  const fallback = _resolvedFallback;
  const activeDict = dictionary[active] ?? {};
  const fallbackDict = active !== fallback ? (dictionary[fallback] ?? {}) : {};
  const pfx = `${prefix}.`;
  const result = /** @type {Record<string, string>} */ ({});

  // Start with fallback entries, then overlay active so per-key fallback works.
  Object.entries(fallbackDict).forEach(([key, mf]) => {
    if (key.startsWith(pfx)) {
      result[key.slice(pfx.length)] = mf.format({});
    }
  });

  Object.entries(activeDict).forEach(([key, mf]) => {
    if (key.startsWith(pfx)) {
      result[key.slice(pfx.length)] = mf.format({});
    }
  });

  return Object.keys(result).length ? result : undefined;
};

// --- Date, time & number ---

/** Reserved preset name defining the options used when no `format` option is given. */
const DEFAULT_FORMAT_KEY = '_default';

// Built-in named formats matching svelte-i18n defaults
/** @type {Record<string, DateFormatPreset>} */
const BUILT_IN_DATE_FORMATS = {
  short: { month: 'numeric', day: 'numeric', year: '2-digit' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
};

/** @type {Record<string, DateFormatPreset>} */
const BUILT_IN_TIME_FORMATS = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
  full: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
};

/** @type {Record<string, NumberFormatPreset>} */
const BUILT_IN_NUMBER_FORMATS = {
  currency: { style: 'currency' },
  percent: { style: 'percent' },
  scientific: { notation: 'scientific' },
  engineering: { notation: 'engineering' },
  compactLong: { notation: 'compact', compactDisplay: 'long' },
  compactShort: { notation: 'compact', compactDisplay: 'short' },
};

/**
 * Built-in presets by kind. `datetime` has no built-ins; its names resolve from `formats.datetime`.
 * @type {Record<string, Record<string, DateFormatPreset | NumberFormatPreset>>}
 */
const BUILT_IN_FORMATS = {
  date: BUILT_IN_DATE_FORMATS,
  time: BUILT_IN_TIME_FORMATS,
  number: BUILT_IN_NUMBER_FORMATS,
};

/**
 * Look up a named preset for the given kind: a custom preset defined in `init({ formats })` first,
 * then a built-in one.
 * @param {string} kind One of `number`, `date`, `time` or `datetime`.
 * @param {string} name Preset name.
 * @returns {DateFormatPreset | NumberFormatPreset | undefined} The preset, or `undefined` if no
 * preset of that name exists for the kind.
 */
const getNamedPreset = (kind, name) =>
  customFormats[/** @type {keyof Formats} */ (kind)]?.[name] ?? BUILT_IN_FORMATS[kind]?.[name];

/**
 * Resolve the preset that should override an MF2 function, preferring an override passed to the
 * current {@link format} call and falling back to the group’s `_default` preset.
 * @param {string} kind One of `number`, `date`, `time` or `datetime`.
 * @returns {DateFormatPreset | NumberFormatPreset | undefined} The preset, or `undefined` when
 * neither the call nor `init({ formats })` provides one for the kind.
 */
const getMessagePreset = (kind) => {
  const spec = messageFormats?.[/** @type {keyof MessageFormats} */ (kind)];
  const preset = typeof spec === 'string' ? getNamedPreset(kind, spec) : spec;

  return preset ?? customFormats[/** @type {keyof Formats} */ (kind)]?.[DEFAULT_FORMAT_KEY];
};

/**
 * Build a replacement for an MF2 message value that formats through `formatter`. Spreading the
 * original keeps its `selectKey`, so `:number` continues to work as a plural selector.
 * @param {any} mv The message value returned by the wrapped MF2 function.
 * @param {Intl.DateTimeFormat | Intl.NumberFormat} formatter Formatter built from the preset.
 * @param {string} [presetLocale] Locale carried by the preset, if any.
 * @returns {any} The replacement message value.
 */
const overrideMessageValue = (mv, formatter, presetLocale) => {
  const value = mv.valueOf();

  return {
    // The spread carries over `selectKey` and `valueOf`, so `:number` keeps working as a plural
    // selector and the value stays usable as an operand for another function.
    ...mv,
    // `MessageFormat.format()` reads `dir` to pick the bidi isolate character, so it has to follow
    // the preset locale. `toParts()` keeps the original formatter, but it is reachable only through
    // `formatToParts()`, which this library does not expose.
    dir: presetLocale ? getTextDirection(new Intl.Locale(presetLocale)) : mv.dir,
    /**
     * Format the value through the preset.
     * @returns {string} The formatted string.
     */
    toString: () => formatter.format(value),
  };
};

/**
 * Wrap an MF2 date/time function so a preset selected for the current {@link format} call replaces
 * the options it resolved.
 * @param {any} fn The MF2 function to wrap.
 * @param {'date' | 'time' | 'datetime'} kind Format kind to look up.
 * @returns {any} The wrapped function.
 */
const wrapDateTimeFunction =
  (fn, kind) =>
  (/** @type {any} */ ctx, /** @type {any} */ options, /** @type {any} */ operand) => {
    const mv = fn(ctx, options, operand);
    const preset = getMessagePreset(kind);

    if (!preset) return mv;

    const { locale: presetLocale, ...rest } = preset;

    return overrideMessageValue(
      mv,
      new Intl.DateTimeFormat(presetLocale ?? ctx.locales, rest),
      presetLocale,
    );
  };

/**
 * Wrap an MF2 number function so a preset selected for the current {@link format} call replaces the
 * options it resolved.
 * @param {any} fn The MF2 function to wrap.
 * @returns {any} The wrapped function.
 */
const wrapNumberFunction =
  (fn) => (/** @type {any} */ ctx, /** @type {any} */ options, /** @type {any} */ operand) => {
    const mv = fn(ctx, options, operand);
    const preset = getMessagePreset('number');

    if (!preset) return mv;

    const { locale: presetLocale, ...rest } = preset;

    return overrideMessageValue(
      mv,
      new Intl.NumberFormat(presetLocale ?? ctx.locales, rest),
      presetLocale,
    );
  };

/**
 * MF2 functions used to compile messages. `:number` and `:integer` come from `DefaultFunctions`;
 * `DraftFunctions` does not define them, and the `functions` option is layered over the defaults,
 * so wrapping the wrong source would shadow them with `undefined`.
 */
const MESSAGE_FUNCTIONS = {
  ...DraftFunctions,
  date: wrapDateTimeFunction(DraftFunctions.date, 'date'),
  time: wrapDateTimeFunction(DraftFunctions.time, 'time'),
  datetime: wrapDateTimeFunction(DraftFunctions.datetime, 'datetime'),
  number: wrapNumberFunction(DefaultFunctions.number),
  integer: wrapNumberFunction(DefaultFunctions.integer),
};

/**
 * Shared implementation for {@link date} and {@link time}.
 * @param {'date' | 'time'} kind `'date'` or `'time'`, selects the format table and error label.
 * @param {Date} value The date to format.
 * @param {DateFormatOptions} [options] Formatting options.
 * @returns {string} The formatted string.
 * @throws {TypeError} If `value` is not a `Date` instance.
 */
const formatDateTimeValue = (kind, value, options = {}) => {
  const { locale: loc, format: fmt, ...rest } = options;

  if (!(value instanceof Date)) {
    throw new TypeError(`${kind}: value must be a Date instance (got ${typeof value})`);
  }

  const defaults = customFormats[kind]?.[DEFAULT_FORMAT_KEY];

  const { locale: presetLocale, ...named } = fmt
    ? (getNamedPreset(kind, fmt) ?? defaults ?? {})
    : (defaults ?? {});

  return new Intl.DateTimeFormat(loc ?? presetLocale ?? _locale, { ...named, ...rest }).format(
    value,
  );
};

/**
 * Format a date value as a localized date string.
 * @param {Date} value The date to format.
 * @param {DateFormatOptions} [options] Formatting options.
 * @returns {string} The formatted date string.
 * @throws {TypeError} If `value` is not a `Date` instance.
 */
const date = (value, options = {}) => formatDateTimeValue('date', value, options);
/**
 * Format a date value as a localized time string.
 * @param {Date} value The date to format.
 * @param {DateFormatOptions} [options] Formatting options.
 * @returns {string} The formatted time string.
 * @throws {TypeError} If `value` is not a `Date` instance.
 */
const time = (value, options = {}) => formatDateTimeValue('time', value, options);

/**
 * Format a number as a localized string.
 * @param {number | bigint} value The number to format.
 * @param {NumberFormatOptions} [options] Formatting options.
 * @returns {string} The formatted number string.
 * @throws {TypeError} If `value` is not a number or bigint.
 */
const number = (value, { locale: loc, format: fmt, ...rest } = {}) => {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new TypeError(`number: value must be a number or bigint (got ${typeof value})`);
  }

  const defaults = customFormats.number?.[DEFAULT_FORMAT_KEY];

  const { locale: presetLocale, ...named } = fmt
    ? (getNamedPreset('number', fmt) ?? defaults ?? {})
    : (defaults ?? {});

  return new Intl.NumberFormat(loc ?? presetLocale ?? _locale, { ...named, ...rest }).format(value);
};

/**
 * Reset all internal state. Intended **only** for use in tests.
 * @internal
 */
const _reset = () => {
  _locale = '';
  locales.splice(0);
  Object.keys(dictionary).forEach((k) => delete dictionary[k]);
  loaderQueue.clear();
  loaderPromises.clear();
  fallbackLocale = '';
  _resolvedFallback = '';
  missingMessageHandler = undefined;
  customFormats = {};
  customFunctions = {};
  messageFormats = undefined;
};

// Export all public API as named exports, and also alias `format` as `_` and `t` for convenience.
// We cannot use `export const` syntax for each symbol because the TypeScript conversion fails to
// export the comments with the functions.
export {
  format as _,
  _reset,
  addMessages,
  date,
  dictionary,
  format,
  getLocaleFromHash,
  getLocaleFromHostname,
  getLocaleFromNavigator,
  getLocaleFromPathname,
  getLocaleFromQueryString,
  init,
  isLoading,
  isRTL,
  json,
  locale,
  locales,
  number,
  register,
  registerMessageFunction,
  format as t,
  time,
  waitLocale,
};
