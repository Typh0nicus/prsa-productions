// Build the existing static portfolio into the Cloudflare Worker layout used by Sites.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CLIENT = path.join(DIST, 'client');
const SERVER = path.join(DIST, 'server');

if (path.dirname(DIST) !== ROOT || path.basename(DIST) !== 'dist') {
  throw new Error('Refusing to build outside the project dist directory.');
}

const files = [
  'index.html',
  'case-study.html',
  'styles.css',
  'credits.json',
  'works.json',
  'work-videos.json',
  'menu-videos.json',
];

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(CLIENT, { recursive: true });
await fs.mkdir(SERVER, { recursive: true });

await Promise.all(files.map((file) => fs.copyFile(path.join(ROOT, file), path.join(CLIENT, file))));
await fs.cp(path.join(ROOT, 'data'), path.join(CLIENT, 'data'), { recursive: true });

// Keep deployment archives lean by copying only assets referenced by the live
// pages and datasets. Retired art stays available in source control.
const referenceFiles = [
  ...files,
  'data/stats.json',
  'data/videos.js',
  'assets/fonts.css',
];
const assetPaths = new Set();
for (const file of referenceFiles) {
  const source = await fs.readFile(path.join(ROOT, file), 'utf8');
  for (const match of source.matchAll(/assets\/[A-Za-z0-9_./-]+/g)) {
    assetPaths.add(match[0]);
  }
}
for (const asset of assetPaths) {
  const source = path.join(ROOT, asset);
  const target = path.join(CLIENT, asset);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}
await fs.cp(path.join(ROOT, 'assets', 'fonts'), path.join(CLIENT, 'assets', 'fonts'), { recursive: true });

const worker = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') url.pathname = '/index.html';
    if (url.pathname === '/case-study') url.pathname = '/case-study.html';
    return env.ASSETS.fetch(new Request(url, request));
  },
};

export default worker;
`;

await fs.writeFile(path.join(SERVER, 'index.js'), worker, 'utf8');
console.log('Sites build ready in dist/');
