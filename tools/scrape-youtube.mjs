// Scrape channels straight off YouTube for work that never went through YTJobs.
// Usage: node tools/scrape-youtube.mjs [--source @Handle]
// Reads:  data/youtube-sources.json
// Writes: data/youtube-videos.json  (merged into data/videos.js by tools/refresh-stats.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getText, postJson, transport } from './net.mjs';
import { canonClient, abbreviate } from './clients.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PAGE_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1' };

// ---- ytInitialData / ytInitialPlayerResponse live in inline <script> blobs ----
const jsonAfter = (html, marker) => {
  const at = html.indexOf(marker);
  if (at === -1) return null;
  let i = html.indexOf('{', at);
  if (i === -1) return null;
  const start = i;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < html.length; i += 1) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } }
    }
  }
  return null;
};

const textOf = (node) => node?.content || node?.simpleText || (node?.runs || []).map((r) => r.text).join('') || '';

// YouTube ships two grid item shapes depending on the A/B bucket you land in.
const readItem = (item) => {
  const lockup = item?.richItemRenderer?.content?.lockupViewModel;
  if (lockup && lockup.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
    const meta = lockup.metadata?.lockupMetadataViewModel;
    const parts = (meta?.metadata?.contentMetadataViewModel?.metadataRows || [])
      .flatMap((row) => (row.metadataParts || []).map((p) => textOf(p.text)))
      .filter(Boolean);
    return {
      id: lockup.contentId,
      title: textOf(meta?.title),
      viewsText: parts.find((p) => /views?$/i.test(p)) || '',
      publishedText: parts.find((p) => /ago$/i.test(p)) || '',
    };
  }
  const v = item?.richItemRenderer?.content?.videoRenderer || item?.gridVideoRenderer;
  if (v?.videoId) {
    return {
      id: v.videoId,
      title: textOf(v.title),
      viewsText: textOf(v.viewCountText),
      publishedText: textOf(v.publishedTimeText),
    };
  }
  return null;
};

const gridOf = (data) => {
  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const t of tabs) {
    const grid = t?.tabRenderer?.content?.richGridRenderer;
    if (grid && /\/videos$/.test(t.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url || '')) return grid;
  }
  return tabs.map((t) => t?.tabRenderer?.content?.richGridRenderer).find(Boolean) || null;
};

const continuationOf = (items) => items?.at(-1)?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || null;

// ---- one channel: newest upload back to (and including) oldestId ----
const scanChannel = async (source) => {
  const handle = source.handle.startsWith('@') ? source.handle : '@' + source.handle;
  const html = await getText(`https://www.youtube.com/${handle}/videos`, PAGE_HEADERS);
  const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];
  const data = jsonAfter(html, 'ytInitialData');
  const grid = gridOf(data);
  if (!grid) throw new Error(`${handle}: no video grid in ytInitialData (YouTube markup changed or the channel is gated)`);
  const channelName = data?.metadata?.channelMetadataRenderer?.title || source.channel || handle;

  const rows = [];
  let items = grid.contents || [];
  let token = continuationOf(items);
  const maxScan = source.maxScan || 120;
  let done = false;

  for (let guard = 0; guard < 12; guard += 1) {
    for (const item of items) {
      const row = readItem(item);
      if (!row?.id) continue;
      rows.push(row);
      if (row.id === source.oldestId) { done = true; break; }
      if (rows.length >= maxScan) { done = true; break; }
    }
    if (done || !token) break;
    const res = await postJson(
      `https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`,
      { context: { client: { clientName: 'WEB', clientVersion, hl: 'en', gl: 'US' } }, continuation: token },
      PAGE_HEADERS,
    );
    items = res?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];
    token = continuationOf(items);
    if (!items.length) break;
  }

  const sawOldest = rows.some((r) => r.id === source.oldestId);
  if (!sawOldest) {
    throw new Error(
      `${handle}: never reached oldestId ${source.oldestId} ("${source.oldestTitle || '?'}") within ${maxScan} uploads. `
      + 'It was probably deleted or made private — repoint oldestId at the oldest upload Gregor is credited on before rerunning.',
    );
  }
  return { channelName, rows };
};

// ---- exact view count + real upload date come from the watch page ----
const enrich = async (id) => {
  const html = await getText(`https://www.youtube.com/watch?v=${id}`, PAGE_HEADERS);
  const player = jsonAfter(html, 'ytInitialPlayerResponse');
  const details = player?.videoDetails || {};
  const micro = player?.microformat?.playerMicroformatRenderer || {};
  return {
    n: Number(details.viewCount) || 0,
    title: details.title || '',
    publishedAt: (micro.publishDate || micro.uploadDate || '').slice(0, 10),
    lengthSeconds: Number(details.lengthSeconds) || 0,
  };
};

const parseAbbrev = (text) => {
  const m = String(text || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(Number(m[1]) * mult);
};

const run = async () => {
  const only = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : null;
  const cfgPath = path.join(ROOT, 'data', 'youtube-sources.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const sources = (cfg.sources || []).filter((s) => !only || s.handle === only || s.client === only);
  if (!sources.length) throw new Error(only ? `no source matching "${only}" in data/youtube-sources.json` : 'no sources configured');

  const videos = [];
  const report = [];

  for (const source of sources) {
    const client = canonClient(source.channel || source.handle.replace(/^@/, '')) || source.client;
    if (client !== source.client) {
      console.log(`note: ${source.channel} maps to "${client}" via tools/clients.mjs; config says "${source.client}" — using the config.`);
    }
    const { channelName, rows } = await scanChannel(source);
    const excludeIds = new Set(source.excludeIds || []);
    const patterns = (source.excludeTitles || []).map((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const excluded = [];
    const kept = [];

    for (const row of rows) {
      const why = excludeIds.has(row.id)
        ? 'excludeIds'
        : (patterns.find((re) => re.test(row.title))?.source || null);
      if (why) excluded.push({ id: row.id, title: row.title, rule: why.replace(/\\/g, '') });
      else kept.push(row);
    }

    console.log(`${source.handle}: scanned ${rows.length}, keeping ${kept.length}, excluded ${excluded.length}`);
    for (const row of kept) {
      const extra = await enrich(row.id).catch(() => null);
      videos.push({
        id: row.id,
        title: extra?.title || row.title,
        thumb: `https://i.ytimg.com/vi/${row.id}/mqdefault.jpg`,
        channel: source.client,
        views: extra?.n ? abbreviate(extra.n) : (row.viewsText.replace(/\s*views?$/i, '') || ''),
        n: extra?.n || parseAbbrev(row.viewsText),
        publishedAt: extra?.publishedAt || '',
        source: 'youtube',
        sourceChannel: channelName,
      });
      process.stdout.write('.');
    }
    process.stdout.write('\n');
    report.push({
      client: source.client,
      handle: source.handle,
      channelName,
      scanned: rows.length,
      kept: kept.length,
      excluded,
      newestId: rows[0]?.id || null,
      newestTitle: rows[0]?.title || '',
      oldestId: source.oldestId,
    });
  }

  videos.sort((a, b) => b.n - a.n);
  const out = {
    note: 'Generated by tools/scrape-youtube.mjs from YouTube directly — do not hand-edit (rerun the tool). Merged into data/videos.js by tools/refresh-stats.mjs.',
    fetchedAt: new Date().toISOString(),
    transport: transport(),
    sources: report,
    totalViews: videos.reduce((sum, v) => sum + v.n, 0),
    videos,
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'youtube-videos.json'), JSON.stringify(out, null, 1) + '\n');

  console.log('--- youtube scrape complete ---');
  for (const r of report) {
    console.log(`${r.client} (${r.channelName}): ${r.kept} kept`);
    for (const x of r.excluded) console.log(`  excluded [${x.rule}] ${x.id} — ${x.title}`);
  }
  console.log('videos written:', videos.length, '| their combined views:', out.totalViews.toLocaleString('en-US'), `(${abbreviate(out.totalViews)})`);
};

run().catch((e) => { console.error('SCRAPE FAILED:', e.message); process.exit(1); });
