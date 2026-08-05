// Refresh ALL site statistics + the full attributed video dataset.
// YTJobs is the source of truth for everything it lists; data/youtube-videos.json
// (written by tools/scrape-youtube.mjs) layers on the channels that never went through it.
// Usage: node tools/refresh-stats.mjs
// Updates: credits.json (subs), works.json (views/likes/channel), data/videos.js (full library),
// index.html (statement total + FALLBACK_CREDITS + FALLBACK_RAIL_WORKS + fallback channel/format patches),
// data/stats.json, data/library-totals.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJson as httpJson } from './net.mjs';
import { ALIASES, MANUAL, canonClient, norm, abbreviate } from './clients.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const API = 'https://app.ytjobs.co/api/talents/58142';
const HEADERS = { Accept: 'application/json', Origin: 'https://ytjobs.co', Referer: 'https://ytjobs.co/' };

const ytIdOf = (v) => {
  const m = (v.url || '').match(/[?&]v=([\w-]{6,})/) || (v.url || '').match(/youtu\.be\/([\w-]{6,})/);
  return m ? m[1] : null;
};
const fmtMillions = (subscribers) => {
  const v = subscribers / 1e6;
  return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
};
const getJson = (url) => httpJson(url, HEADERS);

const run = async () => {
  // ---- fetch talent + all video pages ----
  const talentDoc = await getJson(API + '?showAll=true');
  const talent = talentDoc.talent || talentDoc;
  const yt = talent.youtubeVideos || talentDoc.youtubeVideos;
  const stats = yt.statistics;
  const channels = yt.channels || [];
  const chById = new Map(channels.map((c) => [String(c.id), c]));
  const byName = new Map(channels.map((c) => [norm(c.name), c]));

  const allVideos = [];
  for (let page = 1; page <= 20; page += 1) {
    const doc = await getJson(API + `/videos?limit=100&page=${page}`);
    const vids = doc.youtubeVideos?.videos || [];
    allVideos.push(...vids);
    if (vids.length < 100) break;
  }
  console.log('fetched videos:', allVideos.length, 'of', stats.counts);

  // ---- floor checks: refuse to write a shrunken library ----
  // A 200 response with a renamed/missing key yields [] and reads as "end of list", which would
  // quietly rewrite data/videos.js with a fraction of the roster. data/videos.js is the ONLY
  // source of window.PRSA_VIDEOS and has no inline fallback, so a truncated write empties client
  // shelves on the live site. Bail out loudly instead — the last good file stays on disk.
  const expected = Number(stats.counts) || 0;
  if (expected && allVideos.length < expected * 0.9) {
    throw new Error(
      `YTJobs returned ${allVideos.length} videos but reports ${expected}. Refusing to rewrite the library from a partial `
      + 'response — check the API shape (youtubeVideos.videos) before rerunning; nothing was written.',
    );
  }
  if (!channels.length) {
    throw new Error('YTJobs returned no channels — every video would lose its attribution and drop out of the library. Nothing was written.');
  }

  // ---- canonical attributed dataset ----
  const dataset = new Map();
  for (const v of allVideos) {
    const id = ytIdOf(v);
    if (!id) continue;
    const ch = chById.get(String(v.channelId));
    dataset.set(id, {
      id,
      title: v.title || '',
      thumb: v.thumbnail || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      channel: ch ? canonClient(ch.name) : null,
      views: v.abvViews || '',
      n: Number(v.statistics?.views) || 0,
    });
  }
  // manual overrides / additions
  const overridden = [];
  const added = [];
  for (const [id, channel] of Object.entries(MANUAL)) {
    const existing = dataset.get(id);
    if (existing) {
      if (existing.channel !== channel) { overridden.push(`${id}: ${existing.channel} -> ${channel}`); existing.channel = channel; }
    } else {
      let title = 'Watch on YouTube';
      try {
        const oe = await getJson('https://www.youtube.com/oembed?url=https://youtu.be/' + id + '&format=json');
        if (oe.title) title = oe.title;
      } catch (e) {}
      dataset.set(id, { id, title, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, channel, views: '', n: 0 });
      added.push(id + ' (' + channel + ')');
    }
  }

  // ---- direct-from-YouTube layer (channels YTJobs never listed; see data/youtube-sources.json) ----
  // Scraped straight off the channel, so its title/view figures are fresher than YTJobs' —
  // where the two overlap, YouTube wins.
  const ytDirectPath = path.join(ROOT, 'data', 'youtube-videos.json');
  const ytDirect = fs.existsSync(ytDirectPath) ? JSON.parse(fs.readFileSync(ytDirectPath, 'utf8')) : { videos: [] };
  const directNew = [];
  const directRefreshed = [];
  for (const v of ytDirect.videos || []) {
    const existing = dataset.get(v.id);
    if (existing) directRefreshed.push(`${v.id}: ${existing.views || '—'} -> ${v.views}`);
    else directNew.push(`${v.id} (${v.channel})`);
    dataset.set(v.id, { id: v.id, title: v.title, thumb: v.thumb, channel: v.channel, views: v.views, n: v.n });
  }

  const videosOut = [...dataset.values()].filter((v) => v.channel).sort((a, b) => b.n - a.n);
  const directIds = new Set((ytDirect.videos || []).map((v) => v.id));

  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const videosPath = path.join(dataDir, 'videos.js');
  const videosJs = '// Generated by tools/refresh-stats.mjs from YTJobs — do not hand-edit (rerun the tool).\n'
    + 'window.PRSA_VIDEOS = ' + JSON.stringify(videosOut) + ';\n';
  // Netlify serves this file with a long cache life, so a content change MUST move its ?v= tag
  // in index.html or returning visitors keep the old library. Bump only on a real change.
  const videosChanged = !fs.existsSync(videosPath) || fs.readFileSync(videosPath, 'utf8') !== videosJs;
  fs.writeFileSync(videosPath, videosJs);

  // ---- credits.json subs ----
  const creditsPath = path.join(ROOT, 'credits.json');
  const creditsDoc = JSON.parse(fs.readFileSync(creditsPath, 'utf8'));
  const updated = [];
  const unmatched = [];
  for (const entry of creditsDoc.credits) {
    const ch = byName.get(norm(ALIASES[entry.name] || entry.name));
    if (ch && ch.subscribers) {
      const next = fmtMillions(ch.subscribers);
      if (next !== entry.subs) updated.push(`${entry.name}: ${entry.subs} -> ${next}`);
      entry.subs = next;
    } else {
      unmatched.push(entry.name);
    }
  }
  fs.writeFileSync(creditsPath, JSON.stringify(creditsDoc, null, 1) + '\n');

  // ---- works.json featured: views/likes + channel from the full dataset ----
  const worksPath = path.join(ROOT, 'works.json');
  const worksDoc = JSON.parse(fs.readFileSync(worksPath, 'utf8'));
  const railPath = path.join(ROOT, 'work-videos.json');
  const railDoc = JSON.parse(fs.readFileSync(railPath, 'utf8'));
  const apiVidByYtId = new Map(allVideos.map((v) => [ytIdOf(v), v]).filter(([k]) => k));
  const attributions = [];
  for (const work of worksDoc.featured || []) {
    const entry = dataset.get(work.id);
    const raw = apiVidByYtId.get(work.id);
    if (raw) {
      if (raw.abvViews) work.views = raw.abvViews;
      if (raw.abvLikes) work.likes = raw.abvLikes;
    }
    if (entry && entry.channel) {
      work.channel = entry.channel;
      attributions.push(work.id + ' -> ' + entry.channel);
    }
  }
  fs.writeFileSync(worksPath, JSON.stringify(worksDoc, null, 1) + '\n');

  // ---- index.html: statement + FALLBACK_CREDITS + fallback works channel/views ----
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const abvViews = String(stats.abvViews || '').trim();
  if (/^[\d.]+[KMB]$/.test(abvViews)) {
    html = html.replace(/(Work that&rsquo;s been watched <strong>)[^<]+(<\/strong> times\.)/, `$1${abvViews}+$2`);
  }
  let cacheBump = null;
  if (videosChanged) {
    html = html.replace(/(data\/videos\.js\?v=)(\d+)/, (full, head, n) => {
      cacheBump = `${n} -> ${Number(n) + 1}`;
      return head + (Number(n) + 1);
    });
  }
  const fbStart = html.indexOf('const FALLBACK_CREDITS = [');
  const fbEnd = html.indexOf('];', fbStart);
  if (fbStart !== -1 && fbEnd !== -1) {
    const lines = creditsDoc.credits.map((e) => `  {name:${JSON.stringify(e.name)},avatar:${JSON.stringify(e.avatar)},subs:${e.subs}},`).join('\n');
    html = html.slice(0, fbStart) + 'const FALLBACK_CREDITS = [\n' + lines + '\n' + html.slice(fbEnd);
  }
  const railStart = html.indexOf('const FALLBACK_RAIL_WORKS = [');
  const railEnd = html.indexOf('];', railStart);
  if (railStart !== -1 && railEnd !== -1) {
    const railLines = (railDoc.videos || []).map((w) => {
      const parts = [
        `id:${JSON.stringify(w.id)}`,
        `title:${JSON.stringify(w.title)}`,
        `url:${JSON.stringify(w.url)}`,
        `thumb:${JSON.stringify(w.thumb)}`,
        `thumbFallback:${JSON.stringify(w.thumbFallback || '')}`,
        `format:${JSON.stringify(w.format || 'landscape')}`,
      ];
      return '  {' + parts.join(',') + '},';
    }).join('\n');
    html = html.slice(0, railStart) + 'const FALLBACK_RAIL_WORKS = [\n' + railLines + '\n' + html.slice(railEnd);
  }
  for (const work of worksDoc.featured || []) {
    const re = new RegExp(`(\\{rank:${work.rank},id:'${work.id}'[^}]*?)(,channel:"[^"]*")?\\}`);
    html = html.replace(re, (full, head) => {
      let next = head.replace(/views:'[^']*'/, `views:'${work.views}'`).replace(/likes:'[^']*'/, `likes:'${work.likes}'`);
      return next + (work.channel ? `,channel:${JSON.stringify(work.channel)}}` : '}');
    });
  }
  fs.writeFileSync(indexPath, html);

  // ---- case-study.html: FALLBACK_WORKS + CASE_AVATARS regenerate from works.json/credits.json (never stale) ----
  const casePath = path.join(ROOT, 'case-study.html');
  let caseHtml = fs.readFileSync(casePath, 'utf8');
  const cwStart = caseHtml.indexOf('const FALLBACK_WORKS = [');
  const cwEnd = caseHtml.indexOf('];', cwStart);
  if (cwStart !== -1 && cwEnd !== -1) {
    const caseLines = (worksDoc.featured || []).map((w) => {
      const parts = [
        `rank:${w.rank}`,
        `id:${JSON.stringify(w.id)}`,
        `title:${JSON.stringify(w.title)}`,
        `url:${JSON.stringify(w.url)}`,
        `thumb:${JSON.stringify(w.thumb)}`,
        `thumbFallback:${JSON.stringify(w.thumbFallback || '')}`,
        `views:${JSON.stringify(w.views || '')}`,
        `likes:${JSON.stringify(w.likes || '')}`,
        `role:${w.role ? JSON.stringify(w.role) : 'null'}`,
        `channel:${w.channel ? JSON.stringify(w.channel) : 'null'}`,
        `format:${JSON.stringify(w.format || 'landscape')}`,
      ];
      return '  {' + parts.join(',') + '},';
    }).join('\n');
    caseHtml = caseHtml.slice(0, cwStart) + 'const FALLBACK_WORKS = [\n' + caseLines + '\n' + caseHtml.slice(cwEnd);
  }
  const featuredChannels = new Set((worksDoc.featured || []).map((w) => w.channel).filter(Boolean));
  const avStart = caseHtml.indexOf('const CASE_AVATARS = {');
  const avEnd = avStart === -1 ? -1 : caseHtml.indexOf('};', avStart);
  if (avStart !== -1 && avEnd !== -1) {
    const avLines = creditsDoc.credits.filter((e) => featuredChannels.has(e.name)).map((e) => `  ${JSON.stringify(e.name)}: ${JSON.stringify(e.avatar)},`).join('\n');
    caseHtml = caseHtml.slice(0, avStart) + 'const CASE_AVATARS = {\n' + avLines + '\n' + caseHtml.slice(avEnd);
  }
  fs.writeFileSync(casePath, caseHtml);

  // ---- our own view maths, computed off the library rather than taken from YTJobs ----
  // YTJobs' headline only counts what YTJobs lists; this sums every attributed video we
  // actually hold, including the direct-YouTube layer, so the two can be compared honestly.
  const byClient = new Map();
  let libraryViews = 0;
  for (const v of videosOut) {
    libraryViews += v.n;
    const row = byClient.get(v.channel) || { client: v.channel, videos: 0, views: 0, direct: 0 };
    row.videos += 1;
    row.views += v.n;
    if (directIds.has(v.id)) row.direct += 1;
    byClient.set(v.channel, row);
  }
  const clientRows = [...byClient.values()].sort((a, b) => b.views - a.views)
    .map((r) => ({ ...r, abvViews: abbreviate(r.views) }));
  const ytjobsViews = Number(stats.views) || 0;
  const directViews = videosOut.filter((v) => directIds.has(v.id)).reduce((s, v) => s + v.n, 0);

  fs.writeFileSync(path.join(dataDir, 'library-totals.json'), JSON.stringify({
    note: 'Generated by tools/refresh-stats.mjs — our own count, summed from every attributed video in data/videos.js (YTJobs + the direct-YouTube layer). Not YTJobs\' headline figure; compare the two via stats.json.',
    fetchedAt: new Date().toISOString(),
    libraryVideos: videosOut.length,
    libraryViews,
    libraryAbvViews: abbreviate(libraryViews),
    ytjobsReportedViews: ytjobsViews,
    ytjobsReportedVideos: stats.counts,
    deltaVsYtjobs: libraryViews - ytjobsViews,
    directVideos: directIds.size,
    directViews,
    clients: clientRows,
  }, null, 1) + '\n');

  // ---- data/stats.json ----
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({
    source: API,
    fetchedAt: new Date().toISOString(),
    totalViews: stats.views,
    abvViews: stats.abvViews,
    abvLikes: stats.abvLikes,
    abvComments: stats.abvComments,
    videoCount: stats.counts,
    attributedVideos: videosOut.length,
    channelCount: channels.length,
    libraryViews,
    libraryAbvViews: abbreviate(libraryViews),
    directVideos: directIds.size,
    directViews,
  }, null, 1) + '\n');

  console.log('--- refresh complete ---');
  console.log('data/videos.js:', videosChanged ? `changed — cache tag bumped ${cacheBump || '(tag not found in index.html!)'}` : 'unchanged');
  console.log('YTJobs headline:', ytjobsViews.toLocaleString('en-US'), '(' + stats.abvViews + ') over', stats.counts, 'videos');
  console.log('our library total:', libraryViews.toLocaleString('en-US'), '(' + abbreviate(libraryViews) + ') over', videosOut.length, 'videos');
  console.log('  of which direct-from-YouTube:', directIds.size, 'videos /', directViews.toLocaleString('en-US'), 'views');
  console.log('direct layer — new:', directNew.join(' | ') || 'none');
  console.log('direct layer — refreshed over YTJobs:', directRefreshed.join(' | ') || 'none');
  console.log('manual overrides:', overridden.join(' | ') || 'none');
  console.log('manual additions:', added.join(' | ') || 'none');
  console.log('subs updated:', updated.join(' | ') || 'no changes');
  console.log('credits without YTJobs channel (kept):', unmatched.join(', ') || 'none');
  console.log('featured attributed:', attributions.length + '/' + (worksDoc.featured || []).length);
  console.log('top clients by views:', clientRows.slice(0, 12).map((r) => `${r.client} ${r.abvViews}/${r.videos}`).join('  '));
};

run().catch((e) => { console.error('REFRESH FAILED:', e.message); process.exit(1); });
