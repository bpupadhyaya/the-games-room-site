# The Games Room - website

Public site for The Games Room, a lamp-lit games collection for phones and tablets.
Free to play, fully offline, no ads, no data collected. Coming soon to the App Store and Google Play.

Live: https://equalinformation.com/the-games-room-site/  (GitHub Pages from `main`, no build on the server)

## How the site is made

Almost every page is generated from one file, `games/games.json`, by a dependency-free script:

    node tools/build.mjs          # writes the pages
    node tools/build.mjs --check  # fails if a generated page is out of date
    node test/site.test.js        # builds-check, then follows every link and image

Generated (and committed, because Pages serves files as they are): `index.html`, `games/index.html`
(searchable, filterable list; a plain list without JavaScript), one `<id>/index.html` per game, `sitemap.xml`.
Hand-written: `support/`, `privacy/`, `404.html`, `assets/`. The two playable previews keep their own scripts
(`assets/js/four*.js`, `hearts*.js`; `node test/engines.test.js` checks their engines).

## Add a game in 3 steps

1. Put 3-4 real app screenshots in `assets/shots/` (jpg, quality about 80, long side at most 1000 px) and one
   2:1 card picture `assets/shots/cover-<id>.jpg` (800 x 400).
2. Add one object to `games/games.json` (copy a "coming-soon" entry): `id`, `order`, `name`, `tagline`, `summary`,
   `intro`, `category` (a key of `categories`), `tags`, `accent`, `accent2` (the game's two palette colours),
   `status` (`coming-soon` or `playable-preview`), `cover`, `coverAlt`, `features`, `how`, `tips`, and `shots`
   (file + alt text). For a `playable-preview` also add `preview`: `{ "partial": "games/previews/<id>.html", "scripts": [...] }`.
3. Run `node tools/build.mjs`, then `node test/site.test.js`, commit everything, push.

New categories go in the `categories` object; tag chips on `/games/` appear automatically for any tag used by two games.
Image width and height are read from the files, so pages never shift while loading.

Rules for copy: say "games collection"; no store links until the apps are live (use the coming-soon badge);
company mail aliases only.

Contact: support@equalinformation.com
