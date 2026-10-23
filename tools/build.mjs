#!/usr/bin/env node
// Generates the data-driven pages of the site from games/games.json.
//   node tools/build.mjs          write the pages
//   node tools/build.mjs --check  exit 1 if a generated file is out of date
// No dependencies. Output is committed because GitHub Pages serves files as they are.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const data = JSON.parse(readFileSync(join(ROOT, 'games/games.json'), 'utf8'));
const SITE = data.site;
const games = [...data.games].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
const STATIC_PAGES = ['support/', 'privacy/'];
const HOME_LIMIT = 8;
const STORES = ['App Store', 'Google Play'];

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const abs = (p) => SITE.base + p;
const read = (p) => readFileSync(join(ROOT, p));

function imageSize(path) {
  const b = read(path);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('no size for ' + path);
}

function validate() {
  const ids = new Set();
  for (const g of games) {
    for (const k of ['id', 'name', 'tagline', 'summary', 'intro', 'category', 'accent', 'accent2', 'status', 'cover', 'coverAlt', 'features', 'how', 'shots'])
      if (!g[k] || (Array.isArray(g[k]) && !g[k].length)) throw new Error(`${g.id || g.name}: missing "${k}"`);
    if (ids.has(g.id)) throw new Error('duplicate id ' + g.id);
    ids.add(g.id);
    if (!/^[a-z0-9-]+$/.test(g.id)) throw new Error('bad id ' + g.id);
    if (!['playable-preview', 'coming-soon'].includes(g.status)) throw new Error(g.id + ': bad status');
    if (!data.categories[g.category]) throw new Error(g.id + ': unknown category ' + g.category);
    if (g.status === 'playable-preview' && !g.preview) throw new Error(g.id + ': playable-preview needs "preview"');
    const files = [g.cover, ...g.shots.map((s) => { if (!s.alt) throw new Error(g.id + ': shot without alt'); return s.file; })];
    if (g.preview) files.push(g.preview.partial);
    for (const f of files) if (!existsSync(join(ROOT, f))) throw new Error(`${g.id}: missing file ${f}`);
  }
}

/* ---------- shared pieces ---------- */
function badges(extra = '') {
  return `<div class="tgr-badges" aria-label="Availability">${STORES.map((s, i) =>
    `<span class="tgr-badge-soon"><small>Coming soon${i ? ' to' : ' to the'}</small><b>${s}</b></span>`).join('')}${extra}</div>`;
}

function chrome(depth, { current = '' } = {}) {
  const up = '../'.repeat(depth);
  const tab = (href, label, key) => `<a href="${up}${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return {
    top: `<a class="tgr-skip" href="#tgr-main">Jump to the page</a>
<header class="tgr-top">
<a class="tgr-brand" href="${up || './'}"><img class="tgr-logo" src="${up}assets/img/icon-96.png" alt="" width="40" height="40"><span class="tgr-brand-name">The Games Room</span></a>
<nav class="tgr-tabs" aria-label="Sections">${tab('', 'Home', 'home')}${tab('games/', 'Games', 'games')}${tab('support/', 'Support', 'support')}<a class="tgr-parent" href="https://equalinformation.com/">equalinformation.com<span aria-hidden="true"> &#8599;</span></a></nav>
</header>`,
    foot: `<footer class="tgr-foot">
<section class="tgr-foot-grid">
<div class="tgr-foot-about"><p class="tgr-foot-name">The Games Room</p><p class="tgr-foot-blurb">A warm room full of games. Free to play, no ads, nothing collected, and it works without a connection.</p></div>
<nav class="tgr-foot-tables" aria-label="Games"><h4 class="tgr-foot-h">Games</h4><a href="${up}games/">All ${games.length} games</a>${games.slice(0, 4).map((g) => `<a href="${up}${g.id}/">${esc(g.name)}</a>`).join('')}<a href="${up}#tgr-faq">Questions</a></nav>
<nav class="tgr-foot-help" aria-label="Help"><h4 class="tgr-foot-h">Help</h4><a href="${up}support/">Support</a><a href="${up}privacy/">Privacy</a><a href="mailto:info@equalinformation.com">info@equalinformation.com</a></nav>
</section>
<p class="tgr-fine">&copy; 2026 <a href="https://equalinformation.com/">Equal Information</a>. The apps are coming soon to the App Store and Google Play; those names belong to their respective owners.</p>
</footer>`,
  };
}

function page({ depth, path, title, description, og = SITE.og, body, current, ld = [], bodyStyle = '', bodyClass = '', scripts = [] }) {
  const up = '../'.repeat(depth);
  const c = chrome(depth, { current });
  return `<!DOCTYPE html>
<html class="tgr-root" lang="en-US">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0c0806">
<link rel="canonical" href="${abs(path)}">
<link rel="icon" type="image/png" href="${up}assets/img/favicon.png">
<link rel="apple-touch-icon" href="${up}assets/img/apple-touch-icon.png">
<link rel="stylesheet" href="${up}assets/css/site.css?v=3">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${abs(og)}">
<meta name="twitter:card" content="summary_large_image">
${ld.map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
</head>
<body class="tgr-body${bodyClass ? ' ' + bodyClass : ''}"${bodyStyle ? ` style="${bodyStyle}"` : ''}>
${c.top}
<main class="tgr-main" id="tgr-main">
${body}
</main>
${c.foot}
${scripts.map((s) => `<script defer src="${up}${s}"></script>`).join('\n')}
</body>
</html>
`;
}

function fig(depth, s, { lazy = true, caption = true } = {}) {
  const { w, h } = imageSize(s.file);
  const up = '../'.repeat(depth);
  return `<figure><img src="${up}${s.file}" alt="${esc(s.alt)}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''} decoding="async">${caption ? `<figcaption>${esc(s.alt)}</figcaption>` : ''}</figure>`;
}
function gallery(depth, shots, label, lazyFrom = 0) {
  const wide = shots.some((s) => imageSize(s.file).w > imageSize(s.file).h);
  return `<div class="tgr-gallery${wide ? ' tgr-mixed' : ''}" tabindex="0" role="group" aria-label="${esc(label)}">${shots.map((s, i) => fig(depth, s, { lazy: i >= lazyFrom })).join('')}</div>`;
}

function card(g, depth) {
  const up = '../'.repeat(depth);
  const { w, h } = imageSize(g.cover);
  const state = g.status === 'playable-preview' ? 'Play the preview' : 'Coming soon';
  const text = [g.name, g.tagline, g.summary, data.categories[g.category], ...(g.tags || [])].join(' ').toLowerCase();
  return `<li class="tgr-gc${g.status === 'playable-preview' ? ' tgr-live' : ''}" style="--ga:${g.accent};--gb:${g.accent2}" data-cat="${g.category}" data-tags="${esc((g.tags || []).join('|'))}" data-text="${esc(text)}">
<img src="${up}${g.cover}" alt="${esc(g.coverAlt)}" width="${w}" height="${h}" loading="lazy" decoding="async">
<div class="tgr-gc-body"><span class="tgr-pill">${esc(data.categories[g.category])}</span>
<h3><a class="tgr-gc-name" href="${up}${g.id}/">${esc(g.name)}</a></h3>
<p>${esc(g.summary)}</p>
<span class="tgr-gc-state">${state}</span></div></li>`;
}

/* ---------- home ---------- */
function home() {
  const shown = games.slice(0, HOME_LIMIT);
  const names = games.slice(0, 4).map((g) => g.name);
  const desc = `${games.length} games in one warm, lamp-lit room: ${names.join(', ')} and more. Free to play, fully offline, no ads, no data collected. Try the web previews now. Coming soon to the App Store and Google Play.`;
  const playable = games.filter((g) => g.status === 'playable-preview');
  const hero = data.room.heroShots;
  const heroImg = (s, cls, lazy) => { const { w, h } = imageSize(s.file); return `<div class="tgr-phone tgr-${cls}"><img src="${s.file}" alt="${esc(s.alt)}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''} decoding="async"></div>`; };
  const faq = [
    ['Is The Games Room free?', 'Yes. Every game is free to play at its Easy and Medium levels, with hints and the first lesson. One optional, one-time unlock adds the Hard levels, every lesson, the Cabinet and extras. There is no subscription.'],
    ['Does it need an internet connection?', 'No. The Games Room works completely offline, on a plane or in a cabin.'],
    ['Are there ads? Do you collect my data?', 'There are no ads, and the app collects no data and asks for no account. Your results, streaks and settings stay on your device.'],
    ['When can I get it?', 'The Games Room is coming soon to the App Store and Google Play. This site will link to the stores as soon as the app is available.'],
    ['Which devices?', 'iPhone and iPad, and Android phones and tablets, in portrait and landscape.'],
    ['Is the web preview the full game?', 'No. A preview on this site is a small demo of a game against the computer, at Easy and Medium. The app adds the Hard levels, guided lessons, daily games, the Cabinet, sound and richer animation.'],
    ['Can I play against friends?', 'Several games have pass and play for two people on one device; each game page says what it offers.'],
    ['How do I get help?', 'Write to support@equalinformation.com or open the support page. For privacy questions write to privacy@equalinformation.com.'],
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'MobileApplication', name: SITE.name, applicationCategory: 'GameApplication', operatingSystem: 'iOS, Android', description: `${games.length} games at a lamp-lit table. Free to play, offline, no ads.`, image: abs('assets/img/icon-512.png'), offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const picks = games.slice(0, 12).map((g) => ({ file: g.shots[0].file, alt: g.shots[0].alt }));
  const body = `
<section class="tgr-hero"><div class="tgr-shell">
<div>
<p class="tgr-eyebrow">Games collection, beautifully made</p>
<h1 class="tgr-gilded">The Games Room</h1>
<p class="tgr-lede">Pull up a chair at a lamp-lit table. ${games.length} games, with nothing to sign up for and nothing to wait for.</p>
<div class="tgr-badges">${playable.slice(0, 2).map((g, i) => `<a class="tgr-btn${i ? ' tgr-ghost' : ''}" href="${g.id}/#tgr-play">Play ${esc(g.name)}</a>`).join('')}<a class="tgr-btn tgr-ghost" href="games/">All games</a></div>
${badges()}
<p class="tgr-hero-meta">Free to play &middot; One optional unlock &middot; Works offline &middot; No ads &middot; No data collected</p>
</div>
<div class="tgr-hero-art"><div class="tgr-glow"></div>${heroImg(hero[0], 'a', false)}${heroImg(hero[1], 'b', true)}</div>
</div></section>

<section class="tgr-band" id="tgr-room"><div class="tgr-shell">
<div class="tgr-sec-head"><p class="tgr-eyebrow">The room</p><h2>One lamp, many ways to play</h2>
<p class="tgr-lede">The Games Room is a quiet place to play. Stones, dice, cards and thread feel like real things on the table, and nothing nags or blinks.</p></div>
<div class="tgr-grid tgr-g3">
<div class="tgr-card"><div class="tgr-ico" aria-hidden="true">&#9670;</div><h3>Made to look and feel real</h3><p>Every game has its own materials, lit by its own light. Smooth animation with a Reduce Motion setting, and soft sounds you can switch off.</p></div>
<div class="tgr-card"><div class="tgr-ico" aria-hidden="true">&#9670;</div><h3>Easy on every screen</h3><p>Portrait and landscape on phones and tablets. Adjustable text size and screen reader descriptions for the board, the dice and every button.</p></div>
<div class="tgr-card"><div class="tgr-ico" aria-hidden="true">&#9670;</div><h3>Private by design</h3><p>Fully offline. No ads, no account, no data collected. Your results and streaks stay on your device.</p></div>
</div>
${data.room.roomShot ? `<div class="tgr-roomshot">${fig(0, data.room.roomShot, { caption: false })}</div>` : ''}
</div></section>

<section class="tgr-band" id="tgr-games"><div class="tgr-shell">
<div class="tgr-sec-head"><p class="tgr-eyebrow">The games</p><h2>Take a seat</h2><p>${playable.length ? 'Some games have a free web preview here, so you can try them before the app arrives.' : 'Every game has its own page with screens and the rules.'}</p></div>
<ul class="tgr-gamegrid">${shown.map((g) => card(g, 0)).join('\n')}</ul>
<p class="tgr-allgames"><a class="tgr-btn tgr-ghost" href="games/">See all ${games.length} games</a></p>
</div></section>

<section class="tgr-band" id="tgr-learn"><div class="tgr-shell">
<div class="tgr-grid tgr-g2">
<div><p class="tgr-eyebrow">Learn as you play</p><h2 style="margin:10px 0 14px">Short lessons, one idea at a time</h2>
<p>From how discs fall to bidding by candlelight, and from a first chain of stones to reading a loop puzzle. The first lesson in every game is free.</p>
<ul class="tgr-check"><li>Hints that tell you why, not just where</li><li>Take back a move whenever you like</li><li>Most games offer pass and play for two</li></ul></div>
<div class="tgr-card" id="tgr-lamp"><div class="tgr-ico" aria-hidden="true">&#9728;</div><h3>Tonight's Lamp</h3><p>A fresh daily opening, position or puzzle, the same for everyone. Try it once and see how you do.</p>
<h3 style="margin-top:18px">The Cabinet</h3><p>Your results and streaks, kept on your device and nowhere else.</p></div>
</div></div></section>

<section class="tgr-band tgr-baize" id="tgr-free"><div class="tgr-shell">
<div class="tgr-sec-head"><p class="tgr-eyebrow">Free, plus one simple unlock</p><h2>Everything to enjoy every game is free</h2></div>
<div class="tgr-unlock">
<div class="tgr-card tgr-free"><h3>Free</h3><ul class="tgr-check"><li>Easy and Medium levels</li><li>Solo and pass and play, where a game allows</li><li>Hints and take-backs</li><li>The first lesson in every game</li></ul></div>
<div class="tgr-card"><h3>One optional unlock</h3><ul class="tgr-check"><li>Hard levels</li><li>Every lesson</li><li>The Cabinet: results and streaks</li><li>Extras</li></ul><p class="tgr-muted" style="margin-top:12px">A single one-time purchase. No subscription, no timers, no ads.</p></div>
</div></div></section>

<section class="tgr-band" id="tgr-gallery"><div class="tgr-shell">
<div class="tgr-sec-head"><p class="tgr-eyebrow">Inside the room</p><h2>Screenshots</h2><p class="tgr-muted">Real screens from the app. Scroll sideways to browse.</p></div>
${gallery(0, picks, 'Screenshot gallery', 2)}
</div></section>

<section class="tgr-band" id="tgr-faq"><div class="tgr-shell"><div class="tgr-sec-head"><p class="tgr-eyebrow">Questions</p><h2>Good to know</h2></div>
<div class="tgr-prose">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><div><p>${esc(a)}</p></div></details>`).join('')}</div></div></section>

<section class="tgr-band" id="tgr-contact"><div class="tgr-shell"><div class="tgr-callout"><div class="tgr-t"><h3>Say hello</h3><p>Questions, bug reports or ideas for the next game: <a href="mailto:support@equalinformation.com">support@equalinformation.com</a>. General enquiries: <a href="mailto:contact@equalinformation.com">contact@equalinformation.com</a>. Privacy: <a href="mailto:privacy@equalinformation.com">privacy@equalinformation.com</a>.</p></div>
<a class="tgr-btn" href="support/">Support</a><a class="tgr-btn tgr-ghost" href="privacy/">Privacy</a></div></div></section>`;
  return page({ depth: 0, path: '', title: `The Games Room | ${games.length} games at a lamp-lit table`, description: desc, body, current: 'home', ld });
}

/* ---------- games index ---------- */
function gamesIndex() {
  const cats = Object.entries(data.categories).filter(([k]) => games.some((g) => g.category === k));
  const tagCount = {};
  for (const g of games) for (const t of g.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
  const tags = Object.entries(tagCount).filter(([, n]) => n >= 2).map(([t]) => t).sort();
  const body = `
<article class="tgr-ix">
<header class="tgr-ix-head"><p class="tgr-trail"><a href="../">The Games Room</a> &rsaquo; Games</p>
<h1 class="tgr-gilded tgr-tp-title">All games</h1>
<p class="tgr-lede">${games.length} games so far, each with its own table, its own light and short lessons. Pick one to see how it plays.</p></header>
<div class="tgr-filters" id="tgr-filters" hidden>
<label class="tgr-find"><span class="tgr-sr">Search games</span><input type="search" id="tgr-q" placeholder="Search games" autocomplete="off"></label>
<div class="tgr-chips" role="group" aria-label="Category"><button type="button" class="tgr-chip" data-cat="" aria-pressed="true">All</button>${cats.map(([k, v]) => `<button type="button" class="tgr-chip" data-cat="${k}" aria-pressed="false">${esc(v)}</button>`).join('')}</div>
${tags.length ? `<div class="tgr-chips" role="group" aria-label="Tags">${tags.map((t) => `<button type="button" class="tgr-chip tgr-chip-tag" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>` : ''}
<p class="tgr-count" id="tgr-count" aria-live="polite"></p>
</div>
<ul class="tgr-gamegrid" id="tgr-list">${games.map((g) => card(g, 1)).join('\n')}</ul>
<p class="tgr-empty" id="tgr-empty" hidden>No game matches. Try fewer filters.</p>
</article>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Games in The Games Room', itemListElement: games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(g.id + '/'), name: g.name })) }];
  return page({ depth: 1, path: 'games/', title: `All ${games.length} games | The Games Room`, description: `Every game in The Games Room: ${games.slice(0, 5).map((g) => g.name).join(', ')} and more. Free to play, offline, no ads. Coming soon to the App Store and Google Play.`, body, current: 'games', ld, scripts: ['assets/js/games-filter.js?v=1'] });
}

/* ---------- one game ---------- */
function gamePage(g, i) {
  const prev = games[(i - 1 + games.length) % games.length];
  const next = games[(i + 1) % games.length];
  const preview = g.preview ? readFileSync(join(ROOT, g.preview.partial), 'utf8').trim() : '';
  const live = g.status === 'playable-preview';
  const statusLine = live ? 'The full game is coming soon to the App Store and Google Play.' : 'Coming soon to the App Store and Google Play.';
  const description = g.metaDescription || `${g.intro} ${statusLine}`;
  const title = live ? `${g.name} | Play free in your browser | The Games Room` : `${g.name} | ${g.tagline.replace(/\.$/, '')} | The Games Room`;
  const cover = imageSize(g.cover);
  const ld = [
    { '@context': 'https://schema.org', '@type': ['VideoGame', 'SoftwareApplication'], name: g.name, description: g.summary, url: abs(g.id + '/'), image: abs(g.cover), applicationCategory: 'GameApplication', genre: data.categories[g.category], operatingSystem: 'iOS, Android', inLanguage: 'en', publisher: { '@type': 'Organization', name: 'Equal Information' }, isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.base }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.base }, { '@type': 'ListItem', position: 2, name: 'Games', item: abs('games/') }, { '@type': 'ListItem', position: 3, name: g.name, item: abs(g.id + '/') }] },
  ];
  const shotLabel = `${g.name} screenshots`;
  const body = `
<article class="tgr-tp tgr-gp" style="--ga:${g.accent};--gb:${g.accent2}">
<header class="tgr-tp-head">
<p class="tgr-trail"><a href="../">The Games Room</a> &rsaquo; <a href="../games/">Games</a> &rsaquo; ${esc(g.name)}</p>
<h1 class="tgr-gilded tgr-tp-title">${esc(g.name)}</h1>
<p class="tgr-lede tgr-tp-lede">${esc(g.intro)}</p>
<p class="tgr-tagrow"><span class="tgr-pill">${esc(data.categories[g.category])}</span>${(g.tags || []).map((t) => `<span class="tgr-pill tgr-pill-soft">${esc(t)}</span>`).join('')}</p>
${badges()}
</header>
${live ? preview.replace('class="tgr-tp-play"', 'class="tgr-tp-play"') : `<div class="tgr-tp-play" id="tgr-play">${gallery(1, g.shots, shotLabel, 1)}</div>`}
<aside class="tgr-tp-rules">
<h2 class="tgr-tp-h">The rules in a minute</h2>
<ol class="tgr-steps">${g.how.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${g.keys ? `<h2 class="tgr-tp-h tgr-sub">At the table</h2><dl class="tgr-defs">${g.keys.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
</aside>
<aside class="tgr-tp-keys">
<h2 class="tgr-tp-h">In the app</h2>
<ul class="tgr-check">${g.features.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
</aside>
${g.tips && g.tips.length ? `<aside class="tgr-tp-ideas"><h2 class="tgr-tp-h">Habits of good players</h2><ul class="tgr-check">${g.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></aside>` : ''}
${live ? `<section class="tgr-tp-shots" aria-label="${esc(shotLabel)}"><h2 class="tgr-tp-h">Screens from the app</h2>${gallery(1, g.shots, shotLabel, 1)}</section>` : ''}
<aside class="tgr-tp-cta tgr-callout"><div class="tgr-t"><h3>Get the full game: coming soon</h3><p>${esc(g.name)} is part of The Games Room app for phones and tablets: free to play, fully offline, no ads.</p></div>${STORES.map((s, k) => `<span class="tgr-badge-soon"><small>Coming soon${k ? ' to' : ' to the'}</small><b>${s}</b></span>`).join('')}</aside>
<nav class="tgr-tp-next" aria-label="More games"><a class="tgr-pn tgr-pn-prev" href="../${prev.id}/" rel="prev"><small>Previous</small>${esc(prev.name)}</a><a class="tgr-pn tgr-pn-all" href="../games/">All games</a><a class="tgr-pn tgr-pn-next" href="../${next.id}/" rel="next"><small>Next</small>${esc(next.name)}</a></nav>
</article>`;
  return page({ depth: 1, path: g.id + '/', title, description, body, current: 'game', ld, bodyClass: 'tgr-game', scripts: live ? g.preview.scripts.map((s) => s) : [] });
}

/* ---------- sitemap ---------- */
function sitemap() {
  const urls = ['', 'games/', ...games.map((g) => g.id + '/'), ...STATIC_PAGES];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${abs(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/* ---------- write ---------- */
validate();
const out = new Map();
out.set('index.html', home());
out.set('games/index.html', gamesIndex());
games.forEach((g, i) => out.set(`${g.id}/index.html`, gamePage(g, i)));
out.set('sitemap.xml', sitemap());

let stale = 0;
for (const [p, text] of out) {
  const full = join(ROOT, p);
  const old = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (old === text) continue;
  stale++;
  if (CHECK) { console.error('out of date: ' + p); continue; }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}
console.log(`${out.size} generated files, ${CHECK ? stale + ' out of date' : stale + ' written'}`);
if (CHECK && stale) process.exit(1);
