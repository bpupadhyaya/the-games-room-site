// One functional scenario for the generator: build the site from games/games.json, then follow
// every link and image in every generated page and check each game has a page, a card and a sitemap entry.
// Run: node test/site.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
execFileSync('node', [path.join(root, 'tools/build.mjs'), '--check'], { stdio: 'inherit' });

const data = JSON.parse(fs.readFileSync(path.join(root, 'games/games.json'), 'utf8'));
const base = data.site.base;
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const index = fs.readFileSync(path.join(root, 'games/index.html'), 'utf8');
const pages = ['index.html', 'games/index.html', 'support/index.html', 'privacy/index.html', '404.html'];
data.games.forEach((g) => {
  pages.push(g.id + '/index.html');
  assert(sitemap.includes(`<loc>${base}${g.id}/</loc>`), 'sitemap lists ' + g.id);
  assert(index.includes(`href="../${g.id}/"`), 'games index links ' + g.id);
  assert(!/<a [^>]*href="[^"]*(apps\.apple|play\.google)/i.test(fs.readFileSync(path.join(root, g.id + '/index.html'), 'utf8')), 'no store links yet');
});
const problems = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|data:)/.test(u)) continue;
    const target = u.startsWith('/the-games-room-site/') ? path.join(root, u.slice(21)) : path.resolve(root, path.dirname(p), u);
    const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
    if (!fs.existsSync(file)) problems.push(`${p}: ${u}`);
  }
  for (const m of html.matchAll(/<img [^>]*>/g)) if (!/ alt="/.test(m[0]) || !/ width="/.test(m[0]) || !/ height="/.test(m[0])) problems.push(`${p}: img needs alt, width and height: ${m[0].slice(0, 60)}`);
}
assert.deepStrictEqual(problems, []);
console.log(`site ok: ${pages.length} pages checked`);
