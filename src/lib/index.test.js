/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _,
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
  t,
  time,
  waitLocale,
} from './index.svelte.js';

// MF2 wraps resolved values in Unicode bidi-isolation characters (U+2068 / U+2069).
const stripBidi = (/** @type {string} */ s) => s.replace(/[\u2068\u2069]/g, '');

beforeEach(() => {
  _reset();
});

describe('locale', () => {
  it('starts empty', () => {
    expect(locale.current).toBe('');
  });

  it('set() updates current', () => {
    locale.set('en-US');
    expect(locale.current).toBe('en-US');
  });

  it('throws when value is not a string', () => {
    expect(() => locale.set(/** @type {any} */ (null))).toThrow(TypeError);
    expect(() => locale.set(/** @type {any} */ (42))).toThrow(TypeError);
  });
});

describe('isLoading', () => {
  it('returns false when no locale is set', () => {
    expect(isLoading()).toBe(false);
  });

  it('returns true when locale is set but its messages are not yet available', () => {
    locale.set('en-US');
    expect(isLoading()).toBe(true);
  });

  it('returns false when dictionary has entries but locale is empty', () => {
    addMessages('en-US', { hello: 'Hello!' });
    expect(isLoading()).toBe(false);
  });

  it('returns false once messages for the active locale are loaded', () => {
    addMessages('en-US', { hello: 'Hello!' });
    locale.set('en-US');
    expect(isLoading()).toBe(false);
  });

  it('returns true while an async loader is in-flight, false once it settles', async () => {
    /** @type {(value?: any) => void} */
    let resolve = /** @type {any} */ (undefined);

    const pending = new Promise((res) => {
      resolve = res;
    });

    register('zh', () => pending.then(() => ({ ni: 'Nǐ hǎo' })));
    locale.set('zh');

    expect(isLoading()).toBe(true);
    resolve();
    await waitLocale('zh');
    expect(isLoading()).toBe(false);
  });
});

describe('isRTL', () => {
  it('returns false when no locale is set', () => {
    expect(isRTL()).toBe(false);
  });

  it('returns false for LTR locales', () => {
    locale.set('en-US');
    expect(isRTL()).toBe(false);
  });

  it('returns false for LTR locales (ja)', () => {
    locale.set('ja');
    expect(isRTL()).toBe(false);
  });

  it('returns true for RTL locales (ar)', () => {
    locale.set('ar');
    expect(isRTL()).toBe(true);
  });

  it('returns true for RTL locales (he)', () => {
    locale.set('he');
    expect(isRTL()).toBe(true);
  });

  it('returns true for RTL locales (fa)', () => {
    locale.set('fa');
    expect(isRTL()).toBe(true);
  });

  it('returns true for RTL locales (ur)', () => {
    locale.set('ur');
    expect(isRTL()).toBe(true);
  });

  it('returns false for an invalid locale tag', () => {
    locale.set('!!!invalid!!!');
    expect(isRTL()).toBe(false);
  });
});

describe('getLocaleFromNavigator', () => {
  it('returns the first preferred language from navigator.languages', () => {
    vi.stubGlobal('navigator', { languages: ['fr', 'en-US'], language: 'en-US' });
    expect(getLocaleFromNavigator()).toBe('fr');
    vi.unstubAllGlobals();
  });

  it('falls back to navigator.language when languages is empty', () => {
    vi.stubGlobal('navigator', { languages: [], language: 'ja' });
    expect(getLocaleFromNavigator()).toBe('ja');
    vi.unstubAllGlobals();
  });

  it('falls back to navigator.language when languages is not defined', () => {
    vi.stubGlobal('navigator', { language: 'de' });
    expect(getLocaleFromNavigator()).toBe('de');
    vi.unstubAllGlobals();
  });

  it('returns undefined on the server (no navigator)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(getLocaleFromNavigator()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe('init', () => {
  it('sets locale to initialLocale', () => {
    init({ fallbackLocale: 'en-US', initialLocale: 'fr' });
    expect(locale.current).toBe('fr');
  });

  it('falls back to fallbackLocale when initialLocale is not a registered locale', () => {
    addMessages('en-US', { hello: 'Hello!' });
    init({ fallbackLocale: 'en-US', initialLocale: 'fr' });
    expect(locale.current).toBe('en-US');
  });

  it('does not change locale when initialLocale is omitted', () => {
    init({ fallbackLocale: 'en-US' });
    expect(locale.current).toBe('');
  });

  it('second call updates fallbackLocale without wiping existing messages', () => {
    addMessages('en-US', { hello: 'Hello!' });
    init({ fallbackLocale: 'en-US' });
    init({ fallbackLocale: 'fr' });
    addMessages('fr', { hello: 'Bonjour !' });
    locale.set('de');
    // fallback is now 'fr', but en-US messages still exist
    expect(format('hello')).toBe('Bonjour !');
    expect(dictionary['en-US'].hello).toBeDefined();
  });

  it('throws when fallbackLocale is not a string', () => {
    expect(() => init(/** @type {any} */ ({ fallbackLocale: null }))).toThrow(TypeError);
    expect(() => init(/** @type {any} */ ({ fallbackLocale: 42 }))).toThrow(TypeError);
    expect(() => init(/** @type {any} */ ({}))).toThrow(TypeError);
  });

  it('throws when initialLocale is not a string', () => {
    expect(() => init(/** @type {any} */ ({ fallbackLocale: 'en', initialLocale: 42 }))).toThrow(
      TypeError,
    );
    expect(() => init(/** @type {any} */ ({ fallbackLocale: 'en', initialLocale: null }))).toThrow(
      TypeError,
    );
  });

  it('throws when handleMissingMessage is not a function', () => {
    expect(() =>
      init(/** @type {any} */ ({ fallbackLocale: 'en', handleMissingMessage: 'handler' })),
    ).toThrow(TypeError);
    expect(() =>
      init(/** @type {any} */ ({ fallbackLocale: 'en', handleMissingMessage: 42 })),
    ).toThrow(TypeError);
  });
});

describe('addMessages', () => {
  it('registers the locale in the locales array', () => {
    addMessages('en-US', { hello: 'Hello!' });
    expect(locales).toContain('en-US');
  });

  it('does not add duplicate locales', () => {
    addMessages('en-US', { hello: 'Hello!' });
    addMessages('en-US', { world: 'World!' });
    expect(locales).toHaveLength(1);
  });

  it('merges new keys into an existing locale entry', () => {
    addMessages('en-US', { hello: 'Hello!' });
    addMessages('en-US', { world: 'World!' });
    expect(dictionary['en-US'].hello).toBeDefined();
    expect(dictionary['en-US'].world).toBeDefined();
  });

  it('stores a MessageFormat instance for each key', () => {
    addMessages('en-US', { hello: 'Hello!' });
    expect(typeof dictionary['en-US'].hello.format).toBe('function');
  });

  it('accepts multiple dict arguments and merges them (variadic)', () => {
    addMessages('en-US', { a: 'A' }, { b: 'B' }, { c: 'C' });
    locale.set('en-US');
    expect(format('a')).toBe('A');
    expect(format('b')).toBe('B');
    expect(format('c')).toBe('C');
  });

  it('coerces non-string leaf values to strings (e.g. YAML numbers/booleans)', () => {
    addMessages('en-US', { count: /** @type {any} */ (42), flag: /** @type {any} */ (true) });
    locale.set('en-US');
    expect(format('count')).toBe('42');
    expect(format('flag')).toBe('true');
  });

  it('throws when localeCode is not a non-empty string', () => {
    expect(() => addMessages(/** @type {any} */ (null), {})).toThrow(TypeError);
    expect(() => addMessages(/** @type {any} */ (42), {})).toThrow(TypeError);
    expect(() => addMessages('', {})).toThrow(TypeError);
  });

  it('throws when a map is not a plain object', () => {
    expect(() => addMessages('en', /** @type {any} */ (null))).toThrow(TypeError);
    expect(() => addMessages('en', /** @type {any} */ ('string'))).toThrow(TypeError);
    expect(() => addMessages('en', /** @type {any} */ ([{ a: '1' }]))).toThrow(TypeError);
    expect(() => addMessages('en', {}, /** @type {any} */ (42))).toThrow(TypeError);
  });

  it('re-settles the locale when addMessages() is called after init()', () => {
    init({ fallbackLocale: 'en', initialLocale: 'fr' });
    expect(locale.current).toBe('fr'); // unresolved — no locales registered yet

    addMessages('en', { hello: 'Hello!' });
    expect(locale.current).toBe('en'); // should fall back to 'en'
    expect(isLoading()).toBe(false);
    expect(format('hello')).toBe('Hello!');
  });
});

describe('format / _', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', {
      hello: 'Hello!',
      greeting: 'Hello, {$name}!',
    });
  });

  it('_ is an alias for format', () => {
    expect(_).toBe(format);
  });

  it('formats a simple message', () => {
    expect(format('hello')).toBe('Hello!');
  });

  it('formats a message with variable substitution', () => {
    expect(stripBidi(format('greeting', { values: { name: 'World' } }))).toBe('Hello, World!');
  });

  it('returns the default string for a missing key', () => {
    expect(format('missing', { default: 'Fallback' })).toBe('Fallback');
  });

  it('returns the key itself when no default is provided for a missing key', () => {
    expect(format('missing')).toBe('missing');
  });

  it('falls back to the fallback locale when the active locale has no entry', () => {
    locale.set('fr');
    expect(format('hello')).toBe('Hello!');
  });

  it('resolves fallbackLocale subtag when looking up missing keys (en → en-US)', () => {
    // fallbackLocale is 'en' but messages are stored under 'en-US'
    addMessages('fr', { world: 'Monde' });
    init({ fallbackLocale: 'en', initialLocale: 'fr' });
    expect(format('hello')).toBe('Hello!');
  });

  it('resolves fallbackLocale subtag when looking up missing keys (en-US → en)', () => {
    addMessages('en', { hello: 'Hello!' });
    addMessages('fr', { world: 'Monde' });
    init({ fallbackLocale: 'en-US', initialLocale: 'fr' });
    locale.set('fr');
    expect(format('hello')).toBe('Hello!');
  });

  it('prefers the active locale over the fallback', () => {
    addMessages('fr', { hello: 'Bonjour !' });
    locale.set('fr');
    expect(format('hello')).toBe('Bonjour !');
  });

  it('accepts an options-only object as the first argument (object-first signature)', () => {
    expect(format({ id: 'hello' })).toBe('Hello!');
  });

  it('object-first signature passes values correctly', () => {
    expect(stripBidi(format({ id: 'greeting', values: { name: 'Alice' } }))).toBe('Hello, Alice!');
  });

  it('object-first signature respects locale override', () => {
    addMessages('fr', { greeting: 'Bonjour, {$name}!' });
    expect(stripBidi(format({ id: 'greeting', locale: 'fr', values: { name: 'Alice' } }))).toBe(
      'Bonjour, Alice!',
    );
  });

  it('object-first signature returns default for missing key', () => {
    expect(format({ id: 'missing', default: 'N/A' })).toBe('N/A');
  });

  it('throws when key is null or undefined', () => {
    expect(() => format(/** @type {any} */ (null))).toThrow(TypeError);
    expect(() => format(/** @type {any} */ (undefined))).toThrow(TypeError);
  });
});

describe('pluralization via :integer', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', {
      notifications:
        '.input {$count :integer}\n.match $count\n0   {{You have no notifications.}}\none {{You have {$count} notification.}}\n*   {{You have {$count} notifications.}}',
    });
  });

  it('formats the zero case', () => {
    expect(format('notifications', { values: { count: 0 } })).toBe('You have no notifications.');
  });

  it('formats the singular case', () => {
    expect(stripBidi(format('notifications', { values: { count: 1 } }))).toBe(
      'You have 1 notification.',
    );
  });

  it('formats the plural case', () => {
    expect(stripBidi(format('notifications', { values: { count: 5 } }))).toBe(
      'You have 5 notifications.',
    );
  });
});

describe(':date formatting', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', { today: 'Today is {$date :date}.' });
  });

  it('formats a date without time component', () => {
    const result = format('today', { values: { date: new Date('2022-02-02T12:00:00Z') } });

    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/2022/);
    expect(result).not.toMatch(/:/);
  });
});

// ---------------------------------------------------------------------------
// Variables — https://messageformat.unicode.org/docs/reference/variables/
// ---------------------------------------------------------------------------

describe('.local declarations', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('binds a literal value', () => {
    addMessages('en-US', { msg: '.local $count = {42}\n{{The count is: {$count}}}' });
    expect(stripBidi(format('msg'))).toBe('The count is: 42');
  });

  it('chains: second local references first local', () => {
    addMessages('en-US', {
      msg: '.local $score = {0.42}\n.local $score_percent = {$score :percent}\n{{Your score was {$score_percent}.}}',
    });
    expect(stripBidi(format('msg'))).toBe('Your score was 42%.');
  });

  it('shadows an external variable with the same name', () => {
    // .local $count = {42} ignores the runtime count=32 value
    addMessages('en-US', { msg: '.local $count = {42}\n{{The count is: {$count}}}' });
    expect(stripBidi(format('msg', { values: { count: 32 } }))).toBe('The count is: 42');
  });
});

describe('.input declarations', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('uses the external variable value', () => {
    addMessages('en-US', { msg: '.input {$count :number}\n{{The count is: {$count}}}' });
    expect(stripBidi(format('msg', { values: { count: 32 } }))).toBe('The count is: 32');
  });

  it('applies formatting options declared on the input', () => {
    addMessages('en-US', {
      msg: '.input {$amount :currency currency=USD}\n{{The price is: {$amount}.}}',
    });
    expect(stripBidi(format('msg', { values: { amount: 32 } }))).toBe('The price is: $32.00.');
  });

  it('carries selector options from .input into .match (ordinal)', () => {
    addMessages('en-US', {
      msg: [
        '.input {$rank :number select=ordinal}',
        '.match $rank',
        'one {{This is the {$rank}st most expensive item}}',
        'two {{This is the {$rank}nd most expensive item}}',
        'few {{This is the {$rank}rd most expensive item}}',
        '*   {{This is the {$rank}th most expensive item}}',
      ].join('\n'),
    });
    expect(stripBidi(format('msg', { values: { rank: 2 } }))).toBe(
      'This is the 2nd most expensive item',
    );
    expect(stripBidi(format('msg', { values: { rank: 32 } }))).toBe(
      'This is the 32nd most expensive item',
    );
  });
});

// ---------------------------------------------------------------------------
// Literals — https://messageformat.unicode.org/docs/reference/literals/
// ---------------------------------------------------------------------------

describe('literals', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('unquoted number literal is treated as a string value', () => {
    addMessages('en-US', { msg: '.local $x = {42}\n{{{$x}}}' });
    expect(stripBidi(format('msg'))).toBe('42');
  });

  it('quoted literal preserves spaces and special characters', () => {
    addMessages('en-US', { msg: '.local $x = {|hello world|}\n{{The value is {$x}}}' });
    expect(stripBidi(format('msg'))).toBe('The value is hello world');
  });

  it('quoted option value with hyphen (fields=|year-month-day|)', () => {
    addMessages('en-US', { msg: '{$date :date fields=|year-month-day|}' });

    const result = stripBidi(format('msg', { values: { date: new Date('2024-06-06') } }));

    expect(result).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// Patterns — https://messageformat.unicode.org/docs/reference/patterns/
// ---------------------------------------------------------------------------

describe('patterns', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('escapes backslash as \\\\', () => {
    addMessages('en-US', { msg: 'Backslash: \\\\' });
    expect(format('msg')).toBe('Backslash: \\');
  });

  it('escapes left curly brace as \\{', () => {
    addMessages('en-US', { msg: 'Left brace: \\{' });
    expect(format('msg')).toBe('Left brace: {');
  });

  it('escapes right curly brace as \\}', () => {
    addMessages('en-US', { msg: 'Right brace: \\}' });
    expect(format('msg')).toBe('Right brace: }');
  });

  it('preserves leading and trailing whitespace in a quoted pattern', () => {
    addMessages('en-US', { msg: '.input {$num :number}\n{{   value {$num}   }}' });
    expect(stripBidi(format('msg', { values: { num: 5 } }))).toBe('   value 5   ');
  });
});

// ---------------------------------------------------------------------------
// :number formatting — https://messageformat.unicode.org/docs/reference/functions/
// ---------------------------------------------------------------------------

describe(':number formatting options', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('style=percent multiplies by 100 and appends % (use :percent function)', () => {
    addMessages('en-US', { msg: '{$num :percent}' });
    expect(stripBidi(format('msg', { values: { num: 0.42 } }))).toBe('42%');
  });

  it('signDisplay=always prefixes positive numbers with +', () => {
    addMessages('en-US', { msg: '{$num :number signDisplay=always}' });
    expect(stripBidi(format('msg', { values: { num: 42 } }))).toBe('+42');
  });

  it('minimumFractionDigits pads decimal places', () => {
    addMessages('en-US', { msg: '{$num :number minimumFractionDigits=2}' });
    expect(stripBidi(format('msg', { values: { num: 1 } }))).toBe('1.00');
  });

  it('minimumIntegerDigits pads with leading zeros', () => {
    addMessages('en-US', { msg: '{$num :number minimumIntegerDigits=4}' });
    expect(stripBidi(format('msg', { values: { num: 7 } }))).toBe('0,007');
  });
});

// ---------------------------------------------------------------------------
// :number selection — https://messageformat.unicode.org/docs/reference/functions/
// ---------------------------------------------------------------------------

describe(':number selection', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('select=ordinal matches ordinal plural categories', () => {
    addMessages('en-US', {
      msg: [
        '.input {$num :number select=ordinal}',
        '.match $num',
        'one  {{You are {$num}st}}',
        'two  {{You are {$num}nd}}',
        'few  {{You are {$num}rd}}',
        '*    {{You are {$num}th}}',
      ].join('\n'),
    });
    expect(stripBidi(format('msg', { values: { num: 1 } }))).toBe('You are 1st');
    expect(stripBidi(format('msg', { values: { num: 2 } }))).toBe('You are 2nd');
    expect(stripBidi(format('msg', { values: { num: 3 } }))).toBe('You are 3rd');
    expect(stripBidi(format('msg', { values: { num: 4 } }))).toBe('You are 4th');
  });

  it('select=exact matches literal numeric keys', () => {
    addMessages('en-US', {
      msg: [
        '.input {$num :number select=exact}',
        '.match $num',
        '1 {{one!}}',
        '2 {{two!}}',
        '3 {{three!}}',
        '* {{other!}}',
      ].join('\n'),
    });
    expect(format('msg', { values: { num: 1 } })).toBe('one!');
    expect(format('msg', { values: { num: 2 } })).toBe('two!');
    expect(format('msg', { values: { num: 99 } })).toBe('other!');
  });
});

// ---------------------------------------------------------------------------
// :string function — https://messageformat.unicode.org/docs/reference/functions/
// ---------------------------------------------------------------------------

describe(':string function', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', {
      msg: [
        '.input {$val :string}',
        '.match $val',
        'foo {{Foo}}',
        'bar {{Bar}}',
        '*   {{Other}}',
      ].join('\n'),
    });
  });

  it('matches its exact string value', () => {
    expect(format('msg', { values: { val: 'foo' } })).toBe('Foo');
    expect(format('msg', { values: { val: 'bar' } })).toBe('Bar');
  });

  it('falls through to * when no key matches', () => {
    expect(format('msg', { values: { val: 'baz' } })).toBe('Other');
  });
});

// ---------------------------------------------------------------------------
// :date and :time functions — https://messageformat.unicode.org/docs/reference/functions/
// ---------------------------------------------------------------------------

describe(':date and :time functions', () => {
  const testDate = new Date('2006-01-02T15:04:06');

  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it(':date omits the time component', () => {
    addMessages('en-US', { msg: '{$date :date length=short}' });

    const result = stripBidi(format('msg', { values: { date: testDate } }));

    expect(result).toMatch(/1\/2\/2006/);
  });

  it(':time omits the date component', () => {
    addMessages('en-US', { msg: '{$date :time style=short}' });

    const result = stripBidi(format('msg', { values: { date: testDate } }));

    // short time e.g. "3:04 PM" — just assert it has no year
    expect(result).not.toMatch(/2006/);
    expect(result).toMatch(/:/);
  });
});

// ---------------------------------------------------------------------------
// Multiple selectors — https://messageformat.unicode.org/docs/reference/matchers/
// ---------------------------------------------------------------------------

describe('multiple selectors', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', {
      party: [
        '.input {$hostGender :string}',
        '.input {$guestCount :number}',
        '.match $hostGender $guestCount',
        '  female 0 {{{$hostName} does not give a party.}}',
        '  female 1 {{{$hostName} invites {$guestName} to her party.}}',
        '  female * {{{$hostName} invites {$guestCount} people, including {$guestName}, to her party.}}',
        '  male   0 {{{$hostName} does not give a party.}}',
        '  male   1 {{{$hostName} invites {$guestName} to his party.}}',
        '  male   * {{{$hostName} invites {$guestCount} people, including {$guestName}, to his party.}}',
        '  *      0 {{{$hostName} does not give a party.}}',
        '  *      1 {{{$hostName} invites {$guestName} to their party.}}',
        '  *      * {{{$hostName} invites {$guestCount} people, including {$guestName}, to their party.}}',
      ].join('\n'),
    });
  });

  it('matches female + exact count 1', () => {
    expect(
      stripBidi(
        format('party', {
          values: { hostGender: 'female', hostName: 'Alice', guestCount: 1, guestName: 'Bob' },
        }),
      ),
    ).toBe('Alice invites Bob to her party.');
  });

  it('matches male + wildcard count', () => {
    expect(
      stripBidi(
        format('party', {
          values: { hostGender: 'male', hostName: 'Carlos', guestCount: 5, guestName: 'Dana' },
        }),
      ),
    ).toBe('Carlos invites 5 people, including Dana, to his party.');
  });

  it('matches wildcard gender + zero count', () => {
    expect(
      stripBidi(
        format('party', {
          values: { hostGender: 'other', hostName: 'Sam', guestCount: 0, guestName: 'X' },
        }),
      ),
    ).toBe('Sam does not give a party.');
  });
});

// ---------------------------------------------------------------------------
// Errors — https://messageformat.unicode.org/docs/reference/errors/
// ---------------------------------------------------------------------------

describe('errors', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('returns fallback output when an unknown function is used', () => {
    addMessages('en-US', { msg: '{$x :unknownFn}' });

    const result = format('msg', { values: { x: 'test' } });

    expect(stripBidi(result)).toBe('{$x}');
  });

  it('returns fallback output when a bad operand is passed to :number', () => {
    addMessages('en-US', { msg: '.local $horse = {|horse| :number}\n{{You have a {$horse}.}}' });

    const result = format('msg');

    expect(stripBidi(result)).toContain('{$horse}');
  });

  it('returns fallback output when a bad operand is passed to :datetime', () => {
    addMessages('en-US', {
      msg: '.local $horse = {|horse| :datetime}\n{{You have a {$horse}.}}',
    });

    const result = format('msg');

    expect(stripBidi(result)).toContain('{$horse}');
  });
});

// ---------------------------------------------------------------------------
// t alias
// ---------------------------------------------------------------------------

describe('t alias', () => {
  it('is the same function as format and _', () => {
    expect(t).toBe(format);
    expect(t).toBe(_);
  });
});

// ---------------------------------------------------------------------------
// Per-call locale override
// ---------------------------------------------------------------------------

describe('format with locale override', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', { hi: 'Hello' });
    addMessages('fr', { hi: 'Bonjour' });
  });

  it('uses the override locale instead of the current locale', () => {
    expect(format('hi', { locale: 'fr' })).toBe('Bonjour');
  });

  it('does not change the current locale', () => {
    format('hi', { locale: 'fr' });
    expect(locale.current).toBe('en-US');
  });

  it('falls back to the fallback locale when the override locale has no entry', () => {
    expect(format('hi', { locale: 'de' })).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// handleMissingMessage
// ---------------------------------------------------------------------------

describe('handleMissingMessage', () => {
  it('calls the handler when a key is missing', () => {
    const handler = vi.fn(() => 'MISSING');

    init({ fallbackLocale: 'en-US', initialLocale: 'en-US', handleMissingMessage: handler });
    expect(format('no.such.key')).toBe('MISSING');
    expect(handler).toHaveBeenCalledWith('no.such.key', 'en-US', undefined);
  });

  it('passes the default value to the handler', () => {
    const handler = vi.fn(() => undefined);

    init({ fallbackLocale: 'en-US', initialLocale: 'en-US', handleMissingMessage: handler });
    format('no.such.key', { default: 'Fallback' });
    expect(handler).toHaveBeenCalledWith('no.such.key', 'en-US', 'Fallback');
  });

  it('falls back to key when handler returns undefined', () => {
    init({
      fallbackLocale: 'en-US',
      initialLocale: 'en-US',
      handleMissingMessage: () => undefined,
    });
    expect(format('no.such.key')).toBe('no.such.key');
  });

  it('falls back to default when handler returns undefined', () => {
    init({
      fallbackLocale: 'en-US',
      initialLocale: 'en-US',
      handleMissingMessage: () => undefined,
    });
    expect(format('no.such.key', { default: 'Fallback' })).toBe('Fallback');
  });

  it('is not invoked when a key exists', () => {
    const handler = vi.fn();

    init({ fallbackLocale: 'en-US', initialLocale: 'en-US', handleMissingMessage: handler });
    addMessages('en-US', { exists: 'Found it' });
    expect(format('exists')).toBe('Found it');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// register + waitLocale
// ---------------------------------------------------------------------------

describe('register + waitLocale', () => {
  it('adds the locale to the locales array immediately', () => {
    register('ko', () => Promise.resolve({}));
    expect(locales).toContain('ko');
  });

  it('loads messages via the async loader', async () => {
    register('de', () => Promise.resolve({ hello: 'Hallo' }));
    await waitLocale('de');
    locale.set('de');
    expect(format('hello')).toBe('Hallo');
  });

  it('returns the same promise on repeated waitLocale calls', () => {
    register('nl', () => Promise.resolve({ hello: 'Hoi' }));

    const p1 = waitLocale('nl');
    const p2 = waitLocale('nl');

    expect(p1).toBe(p2);
  });

  it('resolves immediately when no loader is registered for the locale', async () => {
    await expect(waitLocale('sv')).resolves.toBeUndefined();
  });

  it('resolves immediately when localeCode is empty', async () => {
    await expect(waitLocale('')).resolves.toBeUndefined();
  });

  it('throws when localeCode is not a string', async () => {
    expect(() => waitLocale(/** @type {any} */ (42))).toThrow(TypeError);
    expect(() => waitLocale(/** @type {any} */ (null))).toThrow(TypeError);
  });

  it('uses the current locale when called with no argument', async () => {
    register('ro', () => Promise.resolve({ buna: 'Bună' }));
    await locale.set('ro');
    // waitLocale() with no argument should resolve against the already-loaded locale
    await expect(waitLocale()).resolves.toBeUndefined();
    expect(format('buna')).toBe('Bună');
  });

  it('uses the new loader when register is called again for the same locale', async () => {
    register('fi', () => Promise.resolve({ hi: 'Hei' }));
    await waitLocale('fi');
    register('fi', () => Promise.resolve({ hi: 'Moi' }));
    await waitLocale('fi');
    locale.set('fi');
    expect(format('hi')).toBe('Moi');
  });

  it('clears the cached promise when the loader rejects, allowing retry', async () => {
    let shouldFail = true;

    register('it', () =>
      shouldFail ? Promise.reject(new Error('load failed')) : Promise.resolve({ ciao: 'Ciao' }),
    );

    // First call: loader rejects — waitLocale should still resolve (not reject)
    await waitLocale('it');

    // Cached promise should have been cleared; register again with a working loader
    shouldFail = false;
    register('it', () => Promise.resolve({ ciao: 'Ciao' }));
    await waitLocale('it');

    locale.set('it');
    expect(format('ciao')).toBe('Ciao');
  });

  it('falls back from stuck locale when loader rejects and fallback is available', async () => {
    addMessages('en', { hello: 'Hello' });
    init({ fallbackLocale: 'en', initialLocale: 'en' });

    register('fr', () => Promise.reject(new Error('network error')));
    await locale.set('fr');

    // After rejection, locale should fall back to 'en' so isLoading() is false
    expect(isLoading()).toBe(false);
    expect(locale.current).toBe('en');
  });

  it('re-settles the locale when register() is called after init()', async () => {
    init({ fallbackLocale: 'en', initialLocale: 'fr' });
    expect(locale.current).toBe('fr'); // unresolved — no locales registered yet

    register('en', () => Promise.resolve({ hello: 'Hello!' }));
    expect(locale.current).toBe('en'); // should fall back to 'en'

    await waitLocale();
    expect(isLoading()).toBe(false);
    expect(format('hello')).toBe('Hello!');
  });

  it('throws when localeCode is not a non-empty string', () => {
    expect(() => register(/** @type {any} */ (null), () => Promise.resolve({}))).toThrow(TypeError);
    expect(() => register('', () => Promise.resolve({}))).toThrow(TypeError);
  });

  it('throws when loader is not a function', () => {
    expect(() => register('en', /** @type {any} */ ('not-a-function'))).toThrow(TypeError);
    expect(() => register('en', /** @type {any} */ (null))).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// getLocaleFromHostname
// ---------------------------------------------------------------------------

describe('getLocaleFromHostname', () => {
  it('extracts locale from a subdomain', () => {
    vi.stubGlobal('location', { hostname: 'fr.example.com', pathname: '/', search: '', hash: '' });
    expect(getLocaleFromHostname(/^(.*?)\./)).toBe('fr');
    vi.unstubAllGlobals();
  });

  it('returns undefined when the pattern does not match', () => {
    vi.stubGlobal('location', { hostname: 'example.com', pathname: '/', search: '', hash: '' });
    expect(getLocaleFromHostname(/^xx\.(.*)/)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('returns undefined when location is not available (SSR)', () => {
    vi.stubGlobal('location', undefined);
    expect(getLocaleFromHostname(/^(.*?)\./)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('throws when hostnamePattern is not a RegExp', () => {
    expect(() => getLocaleFromHostname(/** @type {any} */ ('fr\\.'))).toThrow(TypeError);
    expect(() => getLocaleFromHostname(/** @type {any} */ (null))).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// getLocaleFromPathname
// ---------------------------------------------------------------------------

describe('getLocaleFromPathname', () => {
  it('extracts locale from the first path segment', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/en-US/about',
      search: '',
      hash: '',
    });
    expect(getLocaleFromPathname(/^\/([\w-]+)\//)).toBe('en-US');
    vi.unstubAllGlobals();
  });

  it('returns undefined when the pattern does not match', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/about',
      search: '',
      hash: '',
    });
    expect(getLocaleFromPathname(/^\/([\w-]+)\/(.*)/)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('returns undefined when location is not available (SSR)', () => {
    vi.stubGlobal('location', undefined);
    expect(getLocaleFromPathname(/^\/([.\w-]+)\//)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('throws when pathnamePattern is not a RegExp', () => {
    expect(() => getLocaleFromPathname(/** @type {any} */ ('/en/.*'))).toThrow(TypeError);
    expect(() => getLocaleFromPathname(/** @type {any} */ (null))).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// getLocaleFromQueryString
// ---------------------------------------------------------------------------

describe('getLocaleFromQueryString', () => {
  it('extracts locale from a query parameter', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/',
      search: '?lang=ja',
      hash: '',
    });
    expect(getLocaleFromQueryString('lang')).toBe('ja');
    vi.unstubAllGlobals();
  });

  it('returns undefined when the key is absent', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/',
      search: '?foo=bar',
      hash: '',
    });
    expect(getLocaleFromQueryString('lang')).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('returns undefined when location is not available (SSR)', () => {
    vi.stubGlobal('location', undefined);
    expect(getLocaleFromQueryString('lang')).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('throws when queryKey is not a non-empty string', () => {
    expect(() => getLocaleFromQueryString(/** @type {any} */ (null))).toThrow(TypeError);
    expect(() => getLocaleFromQueryString('')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// getLocaleFromHash
// ---------------------------------------------------------------------------

describe('getLocaleFromHash', () => {
  it('extracts locale from a hash key=value pair', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/',
      search: '',
      hash: '#lang=fr',
    });
    expect(getLocaleFromHash('lang')).toBe('fr');
    vi.unstubAllGlobals();
  });

  it('returns undefined when the key is absent', () => {
    vi.stubGlobal('location', {
      hostname: 'example.com',
      pathname: '/',
      search: '',
      hash: '#foo=bar',
    });
    expect(getLocaleFromHash('lang')).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('returns undefined when location is not available (SSR)', () => {
    vi.stubGlobal('location', undefined);
    expect(getLocaleFromHash('lang')).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('throws when hashKey is not a non-empty string', () => {
    expect(() => getLocaleFromHash(/** @type {any} */ (null))).toThrow(TypeError);
    expect(() => getLocaleFromHash('')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// locale.set — auto-update <html lang> and auto-trigger loaders
// ---------------------------------------------------------------------------

describe('locale.set — <html lang> update', () => {
  it('updates document.documentElement.lang when the locale changes', () => {
    locale.set('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('sets document.documentElement.dir to ltr for LTR locales', () => {
    locale.set('en-US');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets document.documentElement.dir to rtl for RTL locales', () => {
    locale.set('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('does not touch lang or dir when locale is set to empty string', () => {
    locale.set('ja');

    const prevLang = document.documentElement.lang;
    const prevDir = document.documentElement.dir;

    locale.set('');
    // empty string should leave attributes unchanged (guard skips the block)
    expect(document.documentElement.lang).toBe(prevLang);
    expect(document.documentElement.dir).toBe(prevDir);
  });
});

describe('locale.set — auto-trigger registered loader', () => {
  it('returns a promise that resolves when the loader finishes', async () => {
    register('pt', () => Promise.resolve({ ola: 'Olá' }));
    await locale.set('pt');
    expect(format('ola')).toBe('Olá');
  });

  it('returns a resolved promise when no loader is registered', async () => {
    await expect(locale.set('cs')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// addMessages — nested (deep) dictionary keys
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// locale negotiation
// ---------------------------------------------------------------------------

describe('locale negotiation', () => {
  beforeEach(() => {
    addMessages('en-US', { greeting: 'Hello' });
    addMessages('fr', { greeting: 'Bonjour' });
    addMessages('ja', { greeting: 'こんにちは' });
  });

  it('keeps exact match unchanged', () => {
    locale.set('en-US');
    expect(locale.current).toBe('en-US');
  });

  it('negotiates regional variant to available language match (en-CA → en-US)', () => {
    locale.set('en-CA');
    expect(locale.current).toBe('en-US');
  });

  it('negotiates base language to available regional variant (en → en-US)', () => {
    locale.set('en');
    expect(locale.current).toBe('en-US');
  });

  it('negotiates regional variant to available base language (en-US → en when only en is registered)', () => {
    _reset();
    addMessages('en', { greeting: 'Hello' });
    addMessages('fr', { greeting: 'Bonjour' });
    locale.set('en-US');
    expect(locale.current).toBe('en');
  });

  it('formats messages using the negotiated locale', () => {
    locale.set('en-GB');
    expect(format('greeting')).toBe('Hello');
  });

  it('keeps the value unchanged when no language match exists', () => {
    locale.set('de');
    expect(locale.current).toBe('de');
  });

  it('bypasses negotiation when locales list is empty', () => {
    _reset();
    locale.set('en-CA');
    expect(locale.current).toBe('en-CA');
  });

  it('skips malformed entries in the locales list without throwing', () => {
    // An invalid BCP 47 tag makes new Intl.Locale() throw inside the inner catch.
    // Use 'zh-TW' so no valid language match exists and the loop reaches '!!!'.
    // Register '!!!' via register() so it appears in the locales list without being parsed.
    register('!!!', () => Promise.resolve({}));
    locale.set('zh-TW');
    // No 'zh' entry — negotiation falls back to the original value.
    expect(locale.current).toBe('zh-TW');
  });

  it('returns the requested value unchanged when it is itself an invalid tag', () => {
    // Triggers the outer catch — new Intl.Locale(requested) throws.
    locale.set('!!!');
    expect(locale.current).toBe('!!!');
  });

  it('does not silently clear locale when fallbackLocale has no registered match', () => {
    addMessages('en-US', { greeting: 'Hello' });
    init({ fallbackLocale: 'zh', initialLocale: 'en-US' });
    // 'de' has no match, and fallback 'zh' is not registered either.
    // locale should keep 'de' instead of being silently set to ''.
    locale.set('de');
    expect(locale.current).toBe('de');
    expect(locale.current).not.toBe('');
  });
});

describe('addMessages — nested keys', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('flattens one level of nesting with dot separator', () => {
    addMessages('en-US', { field: { name: 'Name', birth: 'Date of birth' } });
    expect(format('field.name')).toBe('Name');
    expect(format('field.birth')).toBe('Date of birth');
  });

  it('flattens deeply nested objects', () => {
    addMessages('en-US', { a: { b: { c: 'deep' } } });
    expect(format('a.b.c')).toBe('deep');
  });

  it('keeps flat keys with dots as-is', () => {
    addMessages('en-US', { 'already.flat': 'Flat' });
    expect(format('already.flat')).toBe('Flat');
  });

  it('mixes flat and nested keys correctly', () => {
    addMessages('en-US', {
      title: 'Title',
      nav: { home: 'Home', about: 'About' },
    });
    expect(format('title')).toBe('Title');
    expect(format('nav.home')).toBe('Home');
    expect(format('nav.about')).toBe('About');
  });
});

describe('json', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
    addMessages('en-US', { nav: { home: 'Home', about: 'About', contact: 'Contact' } });
  });

  it('returns an object of formatted strings for a group prefix', () => {
    expect(json('nav')).toEqual({ home: 'Home', about: 'About', contact: 'Contact' });
  });

  it('returns undefined for an unknown prefix', () => {
    expect(json('unknown')).toBeUndefined();
  });

  it('respects locale override', () => {
    addMessages('fr', { nav: { home: 'Accueil', about: '\u00c0 propos', contact: 'Contact' } });
    expect(json('nav', { locale: 'fr' })).toEqual({
      home: 'Accueil',
      about: '\u00c0 propos',
      contact: 'Contact',
    });
  });

  it('falls back to fallbackLocale dict when active locale has no messages', () => {
    init({ fallbackLocale: 'en-US', initialLocale: 'fr' });
    expect(json('nav')).toEqual({ home: 'Home', about: 'About', contact: 'Contact' });
  });

  it('falls back to fallbackLocale dict when locale override has no messages', () => {
    // 'de' has no messages; should fall through to fallback 'en-US'
    expect(json('nav', { locale: 'de' })).toEqual({
      home: 'Home',
      about: 'About',
      contact: 'Contact',
    });
  });

  it('throws when prefix is not a non-empty string', () => {
    expect(() => json(/** @type {any} */ (null))).toThrow(TypeError);
    expect(() => json('')).toThrow(TypeError);
    expect(() => json(/** @type {any} */ (42))).toThrow(TypeError);
  });

  it('merges fallback entries with active overriding per-key, ignoring non-matching keys', () => {
    // 'fr' only has `nav.home`; other keys should fall back to 'en-US'.
    // Also add an unrelated key in the fallback to exercise the `key.startsWith(pfx)` false branch.
    addMessages('en-US', { footer: { copyright: '©' } });
    addMessages('fr', { nav: { home: 'Accueil' } });
    expect(json('nav', { locale: 'fr' })).toEqual({
      home: 'Accueil',
      about: 'About',
      contact: 'Contact',
    });
  });
});

describe('json — empty dictionary', () => {
  it('returns undefined when neither active nor fallback locale has a dictionary', () => {
    // global beforeEach clears dictionary; no addMessages called here
    // exercises the `?? {}` branch in: dictionary[active] ?? dictionary[fallback] ?? {}
    expect(json('nav')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// date() / time() / number() standalone formatters
// ---------------------------------------------------------------------------

describe('date() standalone formatter', () => {
  const testDate = new Date('2026-03-15T00:00:00');

  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('formats with default options', () => {
    const result = date(testDate);

    expect(result).toMatch(/2026/);
  });

  it('formats with a built-in named format (short)', () => {
    const result = date(testDate, { format: 'short' });

    // short: { month: 'numeric', day: 'numeric', year: '2-digit' }
    expect(result).toMatch(/26/);
  });

  it('formats with a built-in named format (long)', () => {
    const result = date(testDate, { format: 'long' });

    expect(result).toMatch(/March/);
    expect(result).toMatch(/2026/);
  });

  it('respects locale override', () => {
    const result = date(testDate, { locale: 'fr-FR' });

    expect(result).toMatch(/2026/);
  });

  it('respects inline Intl options', () => {
    const result = date(testDate, { month: 'long' });

    expect(result).toMatch(/March/);
  });

  it('uses custom named format defined in init()', () => {
    init({ fallbackLocale: 'en-US', formats: { date: { myFmt: { year: 'numeric' } } } });

    const result = date(testDate, { format: 'myFmt' });

    expect(result).toBe('2026');
  });

  it('falls back to empty options for an unknown format name', () => {
    // Neither customFormats nor BUILT_IN_DATE_FORMATS has 'unknown' — exercises `?? {}`
    const result = date(testDate, { format: 'unknown' });

    expect(result).toMatch(/2026/);
  });

  it('throws when value is not a Date', () => {
    expect(() => date(/** @type {any} */ ('2026-01-01'))).toThrow(TypeError);
    expect(() => date(/** @type {any} */ (null))).toThrow(TypeError);
  });
});

describe('time() standalone formatter', () => {
  const testTime = new Date('2026-03-15T14:05:00');

  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('formats with a built-in named format (short)', () => {
    const result = time(testTime, { format: 'short' });

    // short: { hour: 'numeric', minute: 'numeric' }
    expect(result).toMatch(/:/);
    expect(result).not.toMatch(/2026/);
  });

  it('respects locale override', () => {
    const result = time(testTime, { locale: 'de-DE', format: 'short' });

    // German short time is '14:05'
    expect(result).toMatch(/14/);
  });

  it('falls back to empty options for an unknown format name', () => {
    // Neither customFormats nor BUILT_IN_TIME_FORMATS has 'unknown' — exercises `?? {}`
    const result = time(testTime, { format: 'unknown' });

    expect(result).toMatch(/2026/);
  });

  it('throws when value is not a Date', () => {
    expect(() => time(/** @type {any} */ (123456789))).toThrow(TypeError);
    expect(() => time(/** @type {any} */ (null))).toThrow(TypeError);
  });
});

describe('number() standalone formatter', () => {
  beforeEach(() => {
    init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
  });

  it('formats a plain number', () => {
    expect(number(1234567)).toBe('1,234,567');
  });

  it('formats with a built-in named format (percent)', () => {
    expect(number(0.42, { format: 'percent' })).toBe('42%');
  });

  it('formats with a built-in named format (compactShort)', () => {
    expect(number(1_500_000, { format: 'compactShort' })).toBe('1.5M');
  });

  it('respects locale override', () => {
    // French uses non-breaking space as thousands separator
    const result = number(1234, { locale: 'fr-FR' });

    expect(result).toMatch(/1/);
    expect(result).toMatch(/234/);
  });

  it('respects inline Intl options', () => {
    expect(number(3.14159, { maximumFractionDigits: 2 })).toBe('3.14');
  });

  it('uses custom named format defined in init()', () => {
    init({
      fallbackLocale: 'en-US',
      formats: { number: { myPct: { style: 'percent', minimumFractionDigits: 1 } } },
    });
    expect(number(0.5, { format: 'myPct' })).toBe('50.0%');
  });

  it('falls back to empty options for an unknown format name', () => {
    // Neither customFormats nor BUILT_IN_NUMBER_FORMATS has 'unknown' — exercises `?? {}`
    const result = number(42, { format: 'unknown' });

    expect(result).toBe('42');
  });

  it('throws when value is not a number', () => {
    expect(() => number(/** @type {any} */ ('42'))).toThrow(TypeError);
    expect(() => number(/** @type {any} */ (null))).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Read-only exports
// ---------------------------------------------------------------------------

describe('reactive exports', () => {
  it('locales reflects registered locales', () => {
    addMessages('en', { hi: 'Hi' });
    expect(locales).toContain('en');
    expect(Array.isArray(locales)).toBe(true);
  });

  it('dictionary reflects registered messages', () => {
    addMessages('en', { hi: 'Hi' });
    expect(dictionary.en).toBeDefined();
    expect(typeof dictionary.en.hi.format).toBe('function');
  });
});
