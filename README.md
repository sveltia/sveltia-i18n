# Sveltia I18n

An internationalization (i18n) library for Svelte applications. Heavily inspired by [svelte-i18n](https://github.com/kaisermann/svelte-i18n), but powered by Svelte 5 Runes and the [messageformat](https://github.com/messageformat/messageformat) library for formatting messages using [Unicode MessageFormat 2](https://messageformat.unicode.org/) (MF2), which supports complex pluralization and selection patterns in addition to simple variable interpolation.

## Table of Contents

- [Motivation](#motivation)
- [Installation](#installation)
- [Usage](#usage)
- [SvelteKit usage](#sveltekit-usage)
  - [Async loading with SSR](#async-loading-with-ssr)
  - [Server-side locale via `Accept-Language`](#server-side-locale-via-accept-language)
  - [Client-side locale detection](#client-side-locale-detection)
- [API](#api)
  - [State](#state)
    - [`locales`](#locales)
    - [`dictionary`](#dictionary)
    - [`isLoading()`](#isloading)
    - [`isRTL(locale?)`](#isrtllocale)
  - [Locale](#locale)
    - [`locale`](#locale-1)
    - [`getLocaleFromNavigator()`](#getlocalefromnavigator)
    - [`getLocaleFromHostname(pattern)`](#getlocalefromhostnamepattern)
    - [`getLocaleFromPathname(pattern)`](#getlocalefrompathnamepattern)
    - [`getLocaleFromQueryString(key)`](#getlocalefromquerystringkey)
    - [`getLocaleFromHash(key)`](#getlocalefromhashkey)
  - [Configuration](#configuration)
    - [`init(options)`](#initoptions)
  - [Loader](#loader)
    - [`register(localeCode, loader)`](#registerlocalecode-loader)
    - [`waitLocale(localeCode?)`](#waitlocalelocalecode)
  - [Messages](#messages)
    - [`addMessages(localeCode, ...maps)`](#addmessageslocalecode-maps)
  - [Formatting](#formatting)
    - [`format(key, options?)` / `_(key, options?)` / `t(key, options?)`](#formatkey-options--_key-options--tkey-options)
    - [`json(prefix, options?)`](#jsonprefix-options)
  - [Date, time & number](#date-time--number)
    - [`date(value, options?)`](#datevalue-options)
    - [`time(value, options?)`](#timevalue-options)
    - [`number(value, options?)`](#numbervalue-options)
- [Message Format](#message-format)
  - [Simple interpolation](#simple-interpolation)
  - [Pluralization](#pluralization)
  - [Ordinal numbers](#ordinal-numbers)
  - [Gender selection](#gender-selection)
  - [Number formatting](#number-formatting)
  - [Date and time](#date-and-time)
  - [Built-in MF2 functions](#built-in-mf2-functions)
- [Compatibility with svelte-i18n](#svelte-i18n-compatibility)
  - [Functions](#functions)
  - [Key differences](#key-differences)
- [Examples](#examples)

## Motivation

We had used [svelte-i18n](https://github.com/kaisermann/svelte-i18n) in our [Sveltia CMS](https://github.com/sveltia/sveltia-cms) for years, appreciating its simplicity and Svelte-native API. However, we wanted to address a significant limitation: the absence of pluralization support. This required us to write logic in our Svelte templates and JavaScript code rather than in our locale files. As we expand our products to more languages, we need a more powerful i18n solution that can handle complex pluralization rules and selection patterns.

Sveltia I18n is the answer: a modern i18n library for Svelte that utilizes Svelte 5 Runes for a clean and efficient API and supports the full capabilities of [Unicode MessageFormat 2](https://messageformat.unicode.org/) (MF2). This allows us to keep all our localization logic in our locale files, making it easier to manage translations in any language.

## Installation

```bash
pnpm add @sveltia/i18n
```

## Usage

```js
import { _, addMessages, init, locale, register, waitLocale } from '@sveltia/i18n';
```

## SvelteKit usage

### Async loading with SSR

Register loaders in a shared module, then await them in the root layout’s `load` function:

```js
// src/lib/i18n.js
import { register, init } from '@sveltia/i18n';

register('en-US', () => import('./locales/en-US.yaml?raw').then((m) => parseYaml(m.default)));
register('fr', () => import('./locales/fr.yaml?raw').then((m) => parseYaml(m.default)));

init({ fallbackLocale: 'en-US' });
```

```js
// src/routes/+layout.js
import { browser } from '$app/environment';
import '$lib/i18n'; // initialize
import { locale, waitLocale, getLocaleFromNavigator } from '@sveltia/i18n';

export const load = async () => {
  if (browser) await locale.set(getLocaleFromNavigator());
  await waitLocale();
};
```

### Server-side locale via `Accept-Language`

Read the request header in a server hook and set the locale before rendering:

```js
// src/hooks.server.js
import { locale } from '@sveltia/i18n';

export const handle = async ({ event, resolve }) => {
  const lang = event.request.headers.get('accept-language')?.split(',')[0];
  if (lang) await locale.set(lang);
  return resolve(event);
};
```

### Client-side locale detection

For client-only apps (no SSR), detect the locale directly from the browser environment and call `locale.set()` in `onMount` or in a `+layout.js` `load` function guarded by `browser`:

```js
// src/routes/+layout.js
import { browser } from '$app/environment';
import '$lib/i18n'; // initialize
import {
  locale,
  waitLocale,
  getLocaleFromNavigator,
  getLocaleFromQueryString,
} from '@sveltia/i18n';

export const load = async () => {
  if (browser) {
    // Pick the first available source: ?lang= query param, then browser preference
    const detected = getLocaleFromQueryString('lang') ?? getLocaleFromNavigator();
    await locale.set(detected ?? 'en-US');
  }
  await waitLocale();
};
```

You can combine any of the `getLocaleFrom*` helpers in priority order:

| Helper                                   | Source                                          |
| ---------------------------------------- | ----------------------------------------------- |
| `getLocaleFromNavigator()`               | `navigator.languages[0]` / `navigator.language` |
| `getLocaleFromQueryString('lang')`       | `?lang=fr` URL parameter                        |
| `getLocaleFromPathname(/^\/([\w-]+)\//)` | `/fr/page` path prefix                          |
| `getLocaleFromHostname(/^([\w-]+)\./)`   | `fr.example.com` subdomain                      |
| `getLocaleFromHash('lang')`              | `#lang=fr` hash parameter                       |

## API

### State

#### `locales`

A reactive array of all registered locale codes.

```js
import { locales } from '@sveltia/i18n';
// ['en-US', 'fr', 'ja']
```

---

#### `dictionary`

A reactive record of all registered messages, keyed by locale code then message key. Values are `Intl.MessageFormat` instances. Useful for advanced inspection; prefer `format`/`_` for normal use.

---

#### `isLoading()`

Returns `true` when a locale has been set but its messages have not yet been loaded. Useful to show a loading indicator or guard rendering until resources are ready.

```js
import { isLoading } from '@sveltia/i18n';
if (isLoading()) return; // messages still loading
```

---

#### `isRTL(locale?)`

Returns `true` when the given locale (or the current locale if omitted) is written right-to-left (e.g. Arabic, Hebrew, Persian). Reactive: re-evaluates automatically whenever the locale changes.

```js
import { isRTL } from '@sveltia/i18n';
if (isRTL()) console.log('RTL layout active');
isRTL('ar'); // → true, regardless of the active locale
isRTL('en-US'); // → false
```

In a Svelte template:

```svelte
<div dir={isRTL() ? 'rtl' : 'ltr'}>
  {_('content')}
</div>
```

---

### Locale

#### `locale`

A reactive object representing the current locale.

```js
locale.current; // → 'en-US'
await locale.set('fr'); // switch to French, triggers any registered loader, updates <html lang>
```

`locale.set(value)` returns a `Promise<void>` that resolves once any loader registered for the new locale has finished loading. It also keeps `document.documentElement.lang` and `document.documentElement.dir` (`ltr`/`rtl`) in sync automatically.

**Locale negotiation:** if the requested value is not in the registered `locales` list, `locale.set()` tries to find the best match by language subtag. If no match is found and `fallbackLocale` resolves to a registered locale, it falls back to that; otherwise the original value is kept. For example, if `en-US` is registered and the user’s browser reports `en-CA`, `locale.current` is set to `en-US`.

```js
// locales registered: ['en-US', 'fr', 'ja'], fallbackLocale: 'en-US'
await locale.set('en-CA'); // language match → locale.current = 'en-US'
await locale.set('zh-TW'); // no match → falls back to 'en-US'
```

#### `getLocaleFromNavigator()`

Returns the user’s preferred locale from the browser (`navigator.languages[0]` or `navigator.language`).

```js
import { getLocaleFromNavigator } from '@sveltia/i18n';
const lang = getLocaleFromNavigator(); // e.g. 'ja'
```

---

#### `getLocaleFromHostname(pattern)`

Matches `location.hostname` against a `RegExp` and returns capture group 1.

```js
import { getLocaleFromHostname } from '@sveltia/i18n';
// URL: https://fr.example.com/
getLocaleFromHostname(/^(.*?)\./); // → 'fr'
```

---

#### `getLocaleFromPathname(pattern)`

Matches `location.pathname` against a `RegExp` and returns capture group 1.

```js
import { getLocaleFromPathname } from '@sveltia/i18n';
// URL: https://example.com/en-US/about
getLocaleFromPathname(/^\/(\w[\w-]*)\//); // → 'en-US'
```

---

#### `getLocaleFromQueryString(key)`

Reads a locale code from a URL query string parameter.

```js
import { getLocaleFromQueryString } from '@sveltia/i18n';
// URL: https://example.com/?lang=ja
getLocaleFromQueryString('lang'); // → 'ja'
```

---

#### `getLocaleFromHash(key)`

Reads a locale code from a `key=value` pair in `location.hash`.

```js
import { getLocaleFromHash } from '@sveltia/i18n';
// URL: https://example.com/#lang=fr
getLocaleFromHash('lang'); // → 'fr'
```

---

### Configuration

#### `init(options)`

Configures the library. All options except `fallbackLocale` are optional.

| Option | Type | Description |
| --- | --- | --- |
| `fallbackLocale` | `string` | Locale used when a key is missing from the current locale. |
| `initialLocale` | `string` | Locale to activate immediately. |
| `formats` | `{ number?, date?, time? }` | Custom named formats for `number()`, `date()`, and `time()`. |
| `handleMissingMessage` | `(key, locale, defaultValue) => string \| void` | Called when a key is not found. Return a string to replace the fallback, or `undefined` to continue with the default behaviour. |

```js
import { getLocaleFromNavigator, init } from '@sveltia/i18n';

init({
  fallbackLocale: 'en-US',
  initialLocale: getLocaleFromNavigator(),
  formats: {
    number: { EUR: { style: 'currency', currency: 'EUR' } },
  },
  handleMissingMessage: (key, locale) => {
    console.warn(`Missing message: ${key} (${locale})`);
  },
});
```

---

### Loader

#### `register(localeCode, loader)`

Registers an async loader function for a locale. The loader is called the first time `waitLocale(localeCode)` is invoked for that locale, and its result is passed to `addMessages`. (`locale.set()` triggers loading by calling `waitLocale()` internally.) Calling `register()` again for the same locale invalidates the cached promise so the new loader is picked up on the next `waitLocale()` call.

```js
import { register, waitLocale, locale } from '@sveltia/i18n';

register('en-US', () => import('./locales/en-US.yaml?raw').then((m) => parseYaml(m.default)));
register('fr', () => import('./locales/fr.yaml?raw').then((m) => parseYaml(m.default)));

// In a SvelteKit +layout.js load function:
export const load = async () => {
  locale.set('en-US');
  await waitLocale();
};
```

---

#### `waitLocale(localeCode?)`

Executes the loader registered for `localeCode` (defaults to `locale.current`) and returns a `Promise<void>` that resolves when the messages are loaded. Repeated calls for the same locale return the same promise (deduplication). Safe to call even when no loader is registered — it resolves immediately. If the loader rejects, the cached promise is cleared so the next `waitLocale()` call will retry.

```js
await waitLocale('fr'); // load French
await waitLocale(); // load the current locale
```

---

### Messages

#### `addMessages(localeCode, ...maps)`

Registers one or more message maps for a locale. Values must be valid [MF2](https://messageformat.unicode.org/) message strings. Maps may be **flat** (dot-separated keys) or **nested** objects — both are normalised to dot-separated keys. Multiple maps are merged in order, matching svelte-i18n’s variadic signature.

```js
import { addMessages } from '@sveltia/i18n';

// Flat
addMessages('en-US', {
  'field.name': 'Name',
  'field.birth': 'Date of birth',
});

// Nested (equivalent)
addMessages('en-US', {
  field: {
    name: 'Name',
    birth: 'Date of birth',
  },
  notifications: `
    .input {$count :integer}
    .match $count
    0   {{You have no notifications.}}
    one {{You have {$count} notification.}}
    *   {{You have {$count} notifications.}}
  `,
});

// Multiple maps merged in one call
addMessages('en-US', { 'field.name': 'Name' }, { 'field.birth': 'Date of birth' });

_('field.name'); // → 'Name'
```

---

### Formatting

#### `format(key, options?)` / `_(key, options?)` / `t(key, options?)`

Formats a message by key. `_` and `t` are aliases for `format`.

Supports two call signatures (matching svelte-i18n):

- `format(id, options?)` — key as first argument
- `format({ id, values?, locale?, default? })` — options object only

| Option | Type | Description |
| --- | --- | --- |
| `values` | `Record<string, any>` | Variables to interpolate into the message. |
| `locale` | `string` | Override the active locale for this call only. If the key is not found in the override locale, the lookup still falls back to `fallbackLocale`. |
| `default` | `string` | Fallback string if the key is not found in any locale. |

Lookup order:

1. Active locale
2. Best-matching registered locale for `fallbackLocale` (e.g. `'en-US'` negotiates to `'en'` if only `'en'` is registered, and vice versa)
3. `default` option value
4. The key string itself

```js
import { _, t } from '@sveltia/i18n';

_('hello', { values: { name: 'Alice' } }); // → 'Hello, Alice!'
_('notifications', { values: { count: 3 } }); // → 'You have 3 notifications.'
_('missing.key', { default: 'Not found' }); // → 'Not found'
_('missing.key'); // → 'missing.key'

// Per-call locale override (does not change locale.current)
_('hello', { locale: 'fr', values: { name: 'Alice' } }); // → 'Bonjour, Alice!'

// Object-first signature (svelte-i18n compatible)
_({ id: 'hello', values: { name: 'Alice' } }); // → 'Hello, Alice!'

// svelte-i18n-style alias
t('hello'); // → 'Hello!'
```

---

#### `json(prefix, options?)`

Returns a flat object of formatted strings for all message keys under the given prefix. Equivalent to svelte-i18n’s `$json()`. Useful for iterating over a group of related messages without knowing every key name.

```js
import { json } from '@sveltia/i18n';

// Locale file has: nav.home, nav.about, nav.contact
json('nav'); // → { home: 'Home', about: 'About', contact: 'Contact' }
json('unknown'); // → undefined
```

Per-key fallback: keys missing from the active locale are filled in from `fallbackLocale`, matching the same per-key fallback behaviour as `format()`.

In a Svelte template:

```svelte
{#each Object.entries(json('nav') ?? {}) as [key, label]}
  <a href="/{key}">{label}</a>
{/each}
```

Options:

| Option   | Type     | Description                              |
| -------- | -------- | ---------------------------------------- |
| `locale` | `string` | Override the active locale for this call |

---

### Date, time & number

#### `date(value, options?)`

Formats a `Date` as a localized date string. Equivalent to svelte-i18n’s `$date()`.

Options accept any `Intl.DateTimeFormatOptions` plus:

| Option | Type | Description |
| --- | --- | --- |
| `locale` | `string` | Override the active locale for this call. |
| `format` | `string` | A named format: `short`, `medium`, `long`, `full`, or a custom name defined in `init({ formats })`. |

```js
import { date } from '@sveltia/i18n';

date(new Date('2026-01-23')); // → '1/23/2026'
date(new Date('2026-01-23'), { format: 'long' }); // → 'January 23, 2026'
date(new Date('2026-01-23'), { locale: 'fr-FR', format: 'long' }); // → '23 janvier 2026'
```

---

#### `time(value, options?)`

Formats a `Date` as a localized time string. Equivalent to svelte-i18n’s `$time()`.

Options accept any `Intl.DateTimeFormatOptions` plus `locale` and `format` (same named formats as `date()` but from the `time` set: `short`, `medium`, `long`, `full`).

```js
import { time } from '@sveltia/i18n';

time(new Date('2026-01-23T15:04:00')); // → '3:04 PM'
time(new Date('2026-01-23T15:04:00'), { format: 'medium' }); // → '3:04:00 PM'
```

---

#### `number(value, options?)`

Formats a number (or bigint) as a localized string. Equivalent to svelte-i18n’s `$number()`.

Options accept any `Intl.NumberFormatOptions` plus:

| Option | Type | Description |
| --- | --- | --- |
| `locale` | `string` | Override the active locale for this call. |
| `format` | `string` | A named format: `currency`, `percent`, `scientific`, `engineering`, `compactLong`, `compactShort`, or a custom name defined in `init({ formats })`. |

```js
import { number } from '@sveltia/i18n';

number(1234567); // → '1,234,567'
number(0.42, { format: 'percent' }); // → '42%'
number(9.99, { style: 'currency', currency: 'USD' }); // → '$9.99'
number(9007199254740993n); // bigint → '9,007,199,254,740,993'

// Custom named format defined in init()
// init({ formats: { number: { EUR: { style: 'currency', currency: 'EUR' } } } })
number(9.99, { format: 'EUR' }); // → '€9.99'
```

---

## Message Format

Locale files use [MF2 syntax](https://messageformat.unicode.org/). Single-pattern messages can be written as plain YAML strings; multi-pattern messages use YAML block scalars.

Note that using YAML is optional; you can use any format as long as you pass the message strings to [`addMessages`](#addmessageslocalecode-maps). We use YAML for its readability and support for multi-line strings, but you could just as easily use JSON, JavaScript modules, or even a custom format.

Sveltia I18n doesn’t bundle a YAML parser, so you need to provide your own (e.g. `yaml` or `js-yaml`) if you want to use YAML files.

### Simple interpolation

```yaml
# en-US.yaml
greeting: 'Hello, {$name}!'
farewell: 'Goodbye, {$name}. See you on {$date :date length=long}.'
```

### Pluralization

English has two plural forms (`one` / `*`):

```yaml
# en-US.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0   {{You have no notifications.}}
    one {{You have {$count} notification.}}
    *   {{You have {$count} notifications.}}
```

French treats 0 as singular:

<!-- cSpell:disable -->

```yaml
# fr.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0   {{Vous n’avez aucune notification.}}
    one {{Vous avez {$count} notification.}}
    *   {{Vous avez {$count} notifications.}}
```

<!-- cSpell:enable -->

Polish has four plural forms — `one`, `few` (2–4, except teens), `many` (5+, teens), and `*` (fractions) — making it a good stress-test for pluralization logic:

<!-- cSpell:disable -->

```yaml
# pl.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0    {{Nie masz żadnych powiadomień.}}
    one  {{Masz {$count} powiadomienie.}}
    few  {{Masz {$count} powiadomienia.}}
    many {{Masz {$count} powiadomień.}}
    *    {{Masz {$count} powiadomienia.}}

items: |
  .input {$count :integer}
  .match $count
    0    {{Nie znaleziono żadnych elementów.}}
    one  {{Znaleziono {$count} element.}}
    few  {{Znaleziono {$count} elementy.}}
    many {{Znaleziono {$count} elementów.}}
    *    {{Znaleziono {$count} elementu.}}
```

<!-- cSpell:enable -->

Arabic has six plural forms (`zero`, `one`, `two`, `few`, `many`, `*`):

<!-- cSpell:disable -->

```yaml
# ar.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0    {{ليس لديك أي إشعارات.}}
    one  {{لديك إشعار واحد.}}
    two  {{لديك إشعاران.}}
    few  {{لديك {$count} إشعارات.}}
    many {{لديك {$count} إشعارًا.}}
    *    {{لديك {$count} إشعار.}}
```

<!-- cSpell:enable -->

Some languages, such as Chinese and Japanese, do not have a plural form. The same word is used for all quantities, except for zero.

```yaml
# zh-CN.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0 {{你没有通知。}}
    * {{你有 {$count} 条通知。}}
```

```yaml
# ja.yaml
notifications: |
  .input {$count :integer}
  .match $count
    0 {{通知はありません。}}
    * {{{$count} 件の通知があります。}}
```

### Ordinal numbers

English ordinal suffixes (`1st`, `2nd`, `3rd`, `4th`, …):

```yaml
# en-US.yaml
ranking: |
  .input {$rank :number select=ordinal}
  .match $rank
    one {{The team is ranked {$rank}st.}}
    two {{The team is ranked {$rank}nd.}}
    few {{The team is ranked {$rank}rd.}}
    *   {{The team is ranked {$rank}th.}}
```

### Gender selection

A single gender variable:

```yaml
# en-US.yaml
welcome: |
  .input {$gender :string}
  .match $gender
    female {{Welcome, Ms. {$name}.}}
    male   {{Welcome, Mr. {$name}.}}
    *      {{Welcome, {$name}.}}
```

Multiple selectors (gender × guest count):

```yaml
# en-US.yaml
party: |
  .input {$hostGender :string}
  .input {$guestCount :number}
  .match $hostGender $guestCount
    female 0 {{{$hostName} does not give a party.}}
    female 1 {{{$hostName} invites {$guestName} to her party.}}
    female * {{{$hostName} invites {$guestCount} people, including {$guestName}, to her party.}}
    male   0 {{{$hostName} does not give a party.}}
    male   1 {{{$hostName} invites {$guestName} to his party.}}
    male   * {{{$hostName} invites {$guestCount} people, including {$guestName}, to his party.}}
    *      0 {{{$hostName} does not give a party.}}
    *      1 {{{$hostName} invites {$guestName} to their party.}}
    *      * {{{$hostName} invites {$guestCount} people, including {$guestName}, to their party.}}
```

### Number formatting

```yaml
# en-US.yaml
price: 'Price: {$amount :currency currency=USD}.'
progress: 'Progress: {$ratio :percent}.'
decimal: 'Value: {$num :number minimumFractionDigits=2}.'
signed: 'Change: {$num :number signDisplay=always}.'
id: 'ID: {$num :number minimumIntegerDigits=4}.'
```

### Date and time

```yaml
# en-US.yaml
today: 'Today is {$date :date}.'
date-short: 'Short date: {$date :date length=short}.'
date-long: 'Long date: {$date :date fields=|month-day-weekday| length=long}.'
datetime: 'Appointment: {$date :datetime}.'
time: 'The time is {$time :time}.'
time-precise: 'Precise time: {$time :time precision=second}.'
```

### Built-in MF2 functions

Built-in MF2 functions available via `DraftFunctions`:

| Function    | Purpose                                  | Example                                |
| ----------- | ---------------------------------------- | -------------------------------------- |
| `:number`   | Decimal number formatting                | `{$n :number minimumFractionDigits=2}` |
| `:integer`  | Integer (no decimals) + plural selection | `{$n :integer}`                        |
| `:percent`  | Percentage (multiplies by 100)           | `{$r :percent}`                        |
| `:currency` | Currency formatting                      | `{$n :currency currency=USD}`          |
| `:date`     | Date-only formatting                     | `{$d :date length=short}`              |
| `:time`     | Time-only formatting                     | `{$t :time precision=second}`          |
| `:datetime` | Date + time formatting                   | `{$d :datetime}`                       |
| `:string`   | String selector                          | `{$s :string}`                         |

---

## Compatibility with svelte-i18n

Sveltia I18n is designed to be a modern alternative to [svelte-i18n](https://github.com/kaisermann/svelte-i18n). The table below summarises the mapping between the two APIs.

### Functions

| svelte-i18n | Sveltia I18n | Notes |
| --- | --- | --- |
| `$_()` / `$t()` / `$format()` | `_()` / `t()` / `format()` | Same two signatures: `(id, opts?)` and `({ id, values?, locale?, default? })`. Not a Svelte store; call directly. |
| `$json()` | `json()` | Identical behaviour. |
| `$date()` | `date()` | Identical signature and named formats (`short`, `medium`, `long`, `full`). |
| `$time()` | `time()` | Identical signature and named formats. |
| `$number()` | `number()` | Identical signature and named formats (`currency`, `percent`, `scientific`, `engineering`, `compactLong`, `compactShort`). |
| `$locale` | `locale` / `locale.current` | Reactive object instead of a Svelte store. Use `locale.current` to read and `locale.set(value)` to write. |
| `$isLoading` | `isLoading()` | Function instead of a store. |
| N/A | `isRTL(locale?)` | Returns `true` when the given locale (or the current locale) is RTL. No svelte-i18n equivalent. |
| `$locales` | `locales` | Reactive array instead of a store. |
| `$dictionary` | `dictionary` | Reactive object instead of a store. |
| `init()` | `init()` | Identical option names. `initialLocale` and `formats` are supported. |
| `addMessages()` | `addMessages()` | Variadic (`...maps`) signature supported. |
| `register()` | `register()` | Identical. |
| `waitLocale()` | `waitLocale()` | Identical. |
| `getLocaleFromNavigator()` | `getLocaleFromNavigator()` | Identical. |
| `getLocaleFromHostname()` | `getLocaleFromHostname()` | Identical. |
| `getLocaleFromPathname()` | `getLocaleFromPathname()` | Identical. |
| `getLocaleFromQueryString()` | `getLocaleFromQueryString()` | Identical. |
| `getLocaleFromHash()` | `getLocaleFromHash()` | Identical. |

### Key differences

- **Message format**: svelte-i18n uses its own `{variable}` interpolation syntax (with optional ICU-style pluralization via `intl-messageformat`). Sveltia I18n uses [Unicode MessageFormat 2 (MF2)](https://messageformat.unicode.org/) syntax exclusively, which is not backwards-compatible. Locale files need to be migrated.
- **Reactivity model**: svelte-i18n exposes Svelte stores. Sveltia I18n uses Svelte 5 Runes (`$state`). Wrap in a reactive context (e.g. `$derived`) or call directly in templates — no `$`-prefix auto-subscription needed.

## Examples

We developed Sveltia I18n to address our needs for internationalization in Svelte applications. It’s currently being used in the following production projects:

- [Sveltia CMS](https://github.com/sveltia/sveltia-cms) — [migration commit](https://github.com/sveltia/sveltia-cms/commit/6d19e25ef102c0b39e26eefdb86ae05bb09f2cf3)
- [Sveltia UI](https://github.com/sveltia/sveltia-ui) — also powers Sveltia CMS — [migration commit](https://github.com/sveltia/sveltia-ui/commit/71e3a5fdf6f04bd0dbcafa464292fdef4d5b78dc)
