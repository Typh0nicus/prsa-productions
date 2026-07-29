// Refresh ALL site statistics + the full attributed video dataset from YTJobs (source of truth).
// Usage: node tools/refresh-stats.mjs
// Updates: credits.json (subs), works.json (views/likes/channel), data/videos.js (full library),
// index.html (statement total + FALLBACK_CREDITS + fallback channel/format patches), data/stats.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const API = 'https://app.ytjobs.co/api/talents/58142';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0', Accept: 'application/json', Origin: 'https://ytjobs.co', Referer: 'https://ytjobs.co/' };

// YTJobs channel name -> our canonical credits.json name (only where they differ)
const CANON = {
  'Futcrunch': 'FutCrunch',
  'EYstreem': 'Eystreem',
  'Amp World': 'AMP',
  "WHAT'S INSIDE? FAMILY": "What's Inside",
  'Noluvmar': 'NoLuvMar',
  'Aj Shabeel': 'AJ Shabeel',
};
const ALIASES = Object.fromEntries(Object.entries(CANON).map(([yt, ours]) => [ours, yt]));

// Secondary/alternate YTJobs channels -> their main board channel (user-confirmed groupings,
// July 21: "link the names between their main channels n secondary ones").
// VIDEO attribution only — subs always come from the main channel, never a secondary.
const CHANNEL_GROUPS = {
  'Lia Roblox': 'SSSniperWolf',
  'Mike Off Record': 'LawByMike',
  'More Lachlan': 'Lachlan',
  'KSI+': 'KSI',
  'Stay Wild Gaming': 'Ben Azelart',
  'More Aj': 'AJ Shabeel',
  'Amp World Gaming': 'AMP',
  'Unspeakable Studios': 'Unspeakable',
  'Sypher Reacts': 'SypherPK',
  'Leah Ashe - Roblox': 'Leah Ashe',
  'More SV2': 'SV2',
  'Crunch Reacts': 'FutCrunch',
  'CashBlox': 'Cash',
};

// Typhon's hand-confirmed attributions (July 21) — authoritative; override API on conflict.
const MANUAL = {
  'g33J4cIIBeo': 'Ben Azelart',
  'JPcqJDMdSPs': 'Preston', '3PZwPRNnPbU': 'Preston', 'mcj-r27uutU': 'Preston',
  'FHF1CNBdBmI': 'FutCrunch',
  'X5kAQTXC-cI': 'Unspeakable', 'ubPMZjJWUns': 'Unspeakable', 'Nx-oA7bsuCY': 'Unspeakable',
  'ZesUFz6tZZc': 'Unspeakable', '_rO1pVAR_rc': 'Unspeakable', 'Uq3-7nrC8gI': 'Unspeakable',
  'Z-KufbXkdMY': 'Unspeakable', 'czXZpCKy1Lg': 'Unspeakable', 'WU05jZnUiYs': 'Unspeakable',
  '32gBph9s-Bc': 'Unspeakable', '6p6m2fwJVmg': 'Unspeakable', 'D5bulg60vvw': 'Unspeakable',
  'Mu4izZLKma8': 'Unspeakable', 'jtEDlRA179Y': 'Unspeakable',
};

const norm = (s) => String(s || '').trim().toLowerCase();
const ytIdOf = (v) => {
  const m = (v.url || '').match(/[?&]v=([\w-]{6,})/) || (v.url || '').match(/youtu\.be\/([\w-]{6,})/);
  return m ? m[1] : null;
};
const fmtMillions = (subscribers) => {
  const v = subscribers / 1e6;
  return v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
};
const getJson = async (url) => {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(url + ' -> ' + res.status);
  return res.json();
};

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

  // ---- canonical attributed dataset ----
  const canonName = (ytName) => CANON[ytName] || CHANNEL_GROUPS[ytName] || ytName;
  const dataset = new Map();
  for (const v of allVideos) {
    const id = ytIdOf(v);
    if (!id) continue;
    const ch = chById.get(String(v.channelId));
    dataset.set(id, {
      id,
      title: v.title || '',
      thumb: v.thumbnail || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      channel: ch ? canonName(ch.name) : null,
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
  const videosOut = [...dataset.values()].filter((v) => v.channel).sort((a, b) => b.n - a.n);

  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(dataDir, 'videos.js'),
    '// Generated by tools/refresh-stats.mjs from YTJobs — do not hand-edit (rerun the tool).\n'
    + 'window.PRSA_VIDEOS = ' + JSON.stringify(videosOut) + ';\n');

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
  const fbStart = html.indexOf('const FALLBACK_CREDITS = [');
  const fbEnd = html.indexOf('];', fbStart);
  if (fbStart !== -1 && fbEnd !== -1) {
    const lines = creditsDoc.credits.map((e) => `  {name:${JSON.stringify(e.name)},avatar:${JSON.stringify(e.avatar)},subs:${e.subs}},`).join('\n');
    html = html.slice(0, fbStart) + 'const FALLBACK_CREDITS = [\n' + lines + '\n' + html.slice(fbEnd);
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
  }, null, 1) + '\n');

  console.log('--- refresh complete ---');
  console.log('total views:', stats.views, '(' + stats.abvViews + ')');
  console.log('attributed videos in dataset:', videosOut.length);
  console.log('manual overrides:', overridden.join(' | ') || 'none');
  console.log('manual additions:', added.join(' | ') || 'none');
  console.log('subs updated:', updated.join(' | ') || 'no changes');
  console.log('credits without YTJobs channel (kept):', unmatched.join(', ') || 'none');
  console.log('featured attributed:', attributions.length + '/16');
  const perCh = {};
  for (const v of videosOut) perCh[v.channel] = (perCh[v.channel] || 0) + 1;
  console.log('per-channel counts:', Object.entries(perCh).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => k + ':' + n).join(' '));
};

run().catch((e) => { console.error('REFRESH FAILED:', e.message); process.exit(1); });
