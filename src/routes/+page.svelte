<script>
  import { parse } from 'yaml';
  import {
    _,
    addMessages,
    date,
    getLocaleFromNavigator,
    init,
    isRTL,
    json,
    locale,
    locales,
    number,
    time,
  } from '$lib/index.svelte.js';

  const currentLocale = $derived(locale.current);

  const resources = import.meta.glob('./locales/*.yaml', {
    eager: true,
    query: '?raw',
    import: 'default',
  });

  Object.entries(resources).forEach(([path, resource]) => {
    addMessages(
      /** @type {string} */ (path.match(/.+\/(?<locale>.+?)\.yaml$/)?.groups?.locale),
      parse(/** @type {string} */ (resource)),
    );
  });

  init({
    fallbackLocale: 'en-US',
    initialLocale: getLocaleFromNavigator(),
  });
</script>

<svelte:head>
  <title>Sveltia I18n Playground</title>
  <meta name="description" content="A playground for Sveltia I18n features." />
</svelte:head>

<h1>Sveltia I18n Playground</h1>

<nav>
  {#each locales as code (code)}
    <button type="button" onclick={() => locale.set(code)} aria-pressed={currentLocale === code}>
      {new Intl.DisplayNames([code], { type: 'language' }).of(code)}
    </button>
  {/each}
</nav>

<p>{isRTL() ? 'This language is read right-to-left.' : 'This language is read left-to-right.'}</p>

<h2>Dates &amp; Times</h2>
<p>{_('today', { values: { date: new Date('2026-01-23') } })}</p>
<p>{_('date-short', { values: { date: new Date('2026-01-23') } })}</p>
<p>{_('date-long', { values: { date: new Date('2026-01-23') } })}</p>
<p>{_('datetime', { values: { date: new Date('2026-01-23T15:04:00') } })}</p>
<p>{_('time', { values: { time: new Date('2026-01-23T15:04:00') } })}</p>
<p>{_('time-precise', { values: { time: new Date('2026-01-23T15:04:30') } })}</p>

<h2>Numbers</h2>
<p>{_('decimal', { values: { num: 1 } })}</p>
<p>{_('signed', { values: { num: 42 } })}</p>
<p>{_('signed', { values: { num: -5 } })}</p>
<p>{_('id', { values: { num: 7 } })}</p>
<p>{_('price', { values: { amount: 9.99 } })}</p>
<p>{_('progress', { values: { ratio: 0.75 } })}</p>

<h2>Pluralization</h2>
<p>{_('notifications', { values: { count: 0 } })}</p>
<p>{_('notifications', { values: { count: 1 } })}</p>
<p>{_('notifications', { values: { count: 2 } })}</p>

<h2>Ordinals</h2>
<p>{_('ranking', { values: { rank: 1 } })}</p>
<p>{_('ranking', { values: { rank: 2 } })}</p>
<p>{_('ranking', { values: { rank: 3 } })}</p>
<p>{_('ranking', { values: { rank: 42 } })}</p>

<h2>Multiple Selectors</h2>
<p>
  {_('party', {
    values: { hostGender: 'female', hostName: 'Alice', guestCount: 0, guestName: 'Bob' },
  })}
</p>
<p>
  {_('party', {
    values: { hostGender: 'female', hostName: 'Alice', guestCount: 1, guestName: 'Bob' },
  })}
</p>
<p>
  {_('party', {
    values: { hostGender: 'male', hostName: 'Carlos', guestCount: 5, guestName: 'Dana' },
  })}
</p>

<h2>Nested Keys</h2>
<p>{_('nav.home')}</p>
<p>{_('nav.about')}</p>
<p>{_('nav.contact')}</p>

<h2>Fallback to fallbackLocale</h2>
<p>{_('en-only')}</p>

<h2>json()</h2>
{#each Object.entries(json('nav') ?? {}) as [key, label] (key)}
  <p>{key}: {label}</p>
{/each}

<h2>Standalone Formatters</h2>
<p>{date(new Date('2026-01-23'))}</p>
<p>{date(new Date('2026-01-23'), { format: 'long' })}</p>
<p>{time(new Date('2026-01-23T15:04:00'), { format: 'short' })}</p>
<p>{number(1234567.89)}</p>
<p>{number(0.42, { format: 'percent' })}</p>
<p>{number(9.99, { style: 'currency', currency: 'USD' })}</p>
<p>{_({ id: 'today', values: { date: new Date('2026-01-23') } })}</p>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    background: #f5f5f5;
    color: #1a1a1a;
    margin: 0;
    padding: 2rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 1.5rem;
  }

  h2 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    margin: 2rem 0 0.5rem;
  }

  nav {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  button {
    padding: 0.4rem 0.9rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 0.875rem;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  button:hover {
    background: #e8e8e8;
  }

  button[aria-pressed='true'] {
    background: #1a1a1a;
    color: #fff;
    border-color: #1a1a1a;
  }

  p {
    margin: 0.25rem 0;
    padding: 0.5rem 0.75rem;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
  }
</style>
