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

await Promise.all([
  ...files.map((file) => fs.copyFile(path.join(ROOT, file), path.join(CLIENT, file))),
  fs.cp(path.join(ROOT, 'assets'), path.join(CLIENT, 'assets'), { recursive: true }),
  fs.cp(path.join(ROOT, 'data'), path.join(CLIENT, 'data'), { recursive: true }),
]);

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
