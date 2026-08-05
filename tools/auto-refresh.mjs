// The unattended run. Point a scheduler at this file and the site's numbers keep themselves current.
// Usage: node tools/auto-refresh.mjs [--quiet] [--skip-youtube] [--no-log]
//
// It snapshots the library, runs the direct-YouTube scrape then the YTJobs refresh, and diffs the
// result: what's new, what moved client, what vanished, and — the part that needs a human — which
// raw channel names look like an existing client under another spelling. Known aliases resolve
// silently through tools/clients.mjs (that map is why "CashBlox" lands on Cash); anything it can't
// resolve is reported, never guessed. Writes data/refresh-log.json and exits non-zero on failure.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { norm, abbreviate } from './clients.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LOG_PATH = path.join(ROOT, 'data', 'refresh-log.json');
const KEEP_RUNS = 20;

const quiet = process.argv.includes('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };

const readLibrary = () => {
  const file = path.join(ROOT, 'data', 'videos.js');
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('[');
  const end = src.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try { return JSON.parse(src.slice(start, end + 1)); } catch { return []; }
};

const readJson = (rel, fallback) => {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

const runTool = (script, args = []) => {
  say(`\n> node tools/${script} ${args.join(' ')}`.trim());
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', script), ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (!quiet) process.stdout.write(out);
  return out;
};

// ---- name similarity, used only to SUGGEST groupings for a human to confirm ----
const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '');
const distance = (a, b) => {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};
// Deliberately loose — a false suggestion costs one glance, a missed one splits a client in two.
const looksRelated = (a, b) => {
  const x = squash(a);
  const y = squash(b);
  if (!x || !y || x === y) return false;
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return true; // CashBlox / Cash
  let shared = 0;
  while (shared < Math.min(x.length, y.length) && x[shared] === y[shared]) shared += 1;
  if (shared >= 4) return true; // Lana Rae / Lana's Life
  return x.length >= 6 && y.length >= 6 && distance(x, y) <= 3; // Lah Mike / LawByMike
};

const run = () => {
  const startedAt = new Date().toISOString();
  const before = readLibrary();
  const beforeById = new Map(before.map((v) => [v.id, v]));
  const beforeStats = readJson('data/stats.json', {});

  const steps = [];
  const sources = readJson('data/youtube-sources.json', { sources: [] }).sources || [];
  if (sources.length && !process.argv.includes('--skip-youtube')) {
    runTool('scrape-youtube.mjs');
    steps.push('scrape-youtube');
  } else {
    say('(no direct-YouTube sources configured — skipping that step)');
  }
  runTool('refresh-stats.mjs');
  steps.push('refresh-stats');

  // ---- diff ----
  const after = readLibrary();
  const afterById = new Map(after.map((v) => [v.id, v]));
  const directIds = new Set((readJson('data/youtube-videos.json', { videos: [] }).videos || []).map((v) => v.id));

  const addedVideos = after
    .filter((v) => !beforeById.has(v.id))
    .map((v) => ({ id: v.id, client: v.channel, title: v.title, views: v.views, n: v.n, via: directIds.has(v.id) ? 'youtube' : 'ytjobs' }))
    .sort((a, b) => b.n - a.n);
  const removedVideos = before.filter((v) => !afterById.has(v.id)).map((v) => ({ id: v.id, client: v.channel, title: v.title }));
  const reattributed = after
    .filter((v) => beforeById.has(v.id) && beforeById.get(v.id).channel !== v.channel)
    .map((v) => ({ id: v.id, title: v.title, from: beforeById.get(v.id).channel, to: v.channel }));

  // ---- client resolution: which names does the board already know? ----
  const creditNames = (readJson('credits.json', { credits: [] }).credits || []).map((c) => c.name);
  const creditSet = new Set(creditNames.map(norm));
  const clientsInLibrary = [...new Set(after.map((v) => v.channel).filter(Boolean))];
  const unclaimed = clientsInLibrary.filter((c) => !creditSet.has(norm(c)));
  const suggestions = [];
  for (const name of unclaimed) {
    // Prefer a match against the credits wall; fall back to another library-only channel
    // (two spellings can both be missing from the wall — "Bov Boys +" and "The Bov Boys").
    const onWall = creditNames.filter((known) => looksRelated(name, known));
    const inLibrary = onWall.length ? [] : clientsInLibrary.filter((other) => other !== name && looksRelated(name, other));
    const near = onWall.length ? onWall : inLibrary;
    if (near.length) {
      suggestions.push({ channel: name, looksLike: near, onWall: onWall.length > 0, videos: after.filter((v) => v.channel === name).length });
    }
  }
  const newClients = clientsInLibrary.filter((c) => !before.some((v) => v.channel === c));

  const totals = readJson('data/library-totals.json', {});
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    libraryVideos: after.length,
    libraryViews: totals.libraryViews ?? after.reduce((s, v) => s + (v.n || 0), 0),
    viewsDelta: (totals.libraryViews ?? 0) - (beforeStats.libraryViews ?? beforeStats.totalViews ?? 0),
    videosDelta: after.length - before.length,
    addedVideos,
    removedVideos,
    reattributed,
    newClients,
    unclaimedClients: unclaimed,
    groupingSuggestions: suggestions,
  };

  if (!process.argv.includes('--no-log')) {
    const log = readJson('data/refresh-log.json', { note: '', runs: [] });
    log.note = 'Written by tools/auto-refresh.mjs. Newest run first; the last ' + KEEP_RUNS + ' are kept. Audit trail for the unattended refresh — nothing on the site reads this.';
    log.runs = [summary, ...(log.runs || [])].slice(0, KEEP_RUNS);
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 1) + '\n');
  }

  console.log('\n=== auto-refresh summary ===');
  console.log(`library: ${after.length} videos (${summary.videosDelta >= 0 ? '+' : ''}${summary.videosDelta}), ${abbreviate(summary.libraryViews)} views (${summary.viewsDelta >= 0 ? '+' : ''}${summary.viewsDelta.toLocaleString('en-US')})`);
  if (addedVideos.length) {
    console.log(`new videos (${addedVideos.length}):`);
    for (const v of addedVideos.slice(0, 25)) console.log(`  [${v.via}] ${v.client} — ${v.views || '?'} — ${v.title}`);
    if (addedVideos.length > 25) console.log(`  …and ${addedVideos.length - 25} more (see data/refresh-log.json)`);
  } else console.log('new videos: none');
  if (removedVideos.length) console.log(`gone (${removedVideos.length}):`, removedVideos.map((v) => `${v.client}/${v.id}`).join(' '));
  if (reattributed.length) console.log('re-attributed:', reattributed.map((v) => `${v.id} ${v.from} -> ${v.to}`).join(' | '));
  if (newClients.length) console.log('clients new to the library:', newClients.join(', '));
  if (suggestions.length) {
    console.log('\nNEEDS A HUMAN — channel names that look like a client we already track.');
    console.log('Add a CHANNEL_GROUPS line in tools/clients.mjs only if Typhon confirms it is the same person:');
    for (const s of suggestions) {
      const alt = s.looksLike.length > 1 ? ' — or ' + s.looksLike.slice(1).join(' / ') : '';
      console.log(`  '${s.channel}': '${s.looksLike[0]}',   // ${s.videos} video(s)${s.onWall ? '' : ' — neither name is on the credits wall'}${alt}`);
    }
  }
  const unmapped = unclaimed.filter((c) => !suggestions.some((s) => s.channel === c));
  if (unmapped.length) console.log(`\nchannels with videos but no credits.json entry (${unmapped.length}):`, unmapped.join(', '));
  console.log('\nlog:', path.relative(ROOT, LOG_PATH));
  console.log('Data files changed on disk — review `git diff` and commit when you are happy with it.');
};

try {
  run();
} catch (err) {
  console.error('AUTO-REFRESH FAILED:', err.message);
  if (err.stdout) process.stderr.write(String(err.stdout));
  process.exit(1);
}
