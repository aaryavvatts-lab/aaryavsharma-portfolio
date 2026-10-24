// Pulls the 87 county shapes and their real results from EDAN's home page
// (edanmn.vercel.app, which Aaryav built) into src/content/edan-map.json.
// Run: node tools/edan-map/extract.mjs   (keeps a dated copy of the source page)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const html = await (await fetch('https://edanmn.vercel.app/')).text();
const day = new Date().toISOString().slice(0, 10);
mkdirSync(join(here, 'source'), { recursive: true });
writeFileSync(join(here, 'source', `edan-home-${day}.html`), html);

const box = html.match(/<svg viewBox="(0 0 1000 [\d.]+)" role="group" aria-labelledby="hm-title/);
if (!box) throw new Error('county map svg not found');
const re = /<a href="\/counties\/([a-z-]+)\/" aria-label="([^"]+)">\s*<path class="county k\d" d="([^"]+)"[^>]*data-name="([^"]+)" data-v="(\d+)" data-n="(\d+)"/g;
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const counties = [...html.matchAll(re)].map((m) => ({
  slug: m[1],
  name: unescape(m[4]),
  label: unescape(m[2]),
  noPlan: Number(m[5]),
  districts: Number(m[6]),
  d: m[3],
}));
if (counties.length !== 87) throw new Error(`expected 87 counties, got ${counties.length}`);
counties.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(root, 'src', 'content', 'edan-map.json'),
  JSON.stringify({ viewBox: box[1], source: 'https://edanmn.vercel.app/', fetched: day, counties }) + '\n');
console.log(`edan-map.json: ${counties.length} counties, ${(JSON.stringify(counties).length / 1024).toFixed(1)} KB`);
