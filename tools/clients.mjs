// The single client-identity map. Every scraper resolves a raw channel name through
// canonClient() so one client never lands on the board twice under two spellings —
// this is what makes "CashBlox" and "Cash" the same person to the pipeline.

// YTJobs channel name -> our canonical credits.json name (only where they differ)
export const CANON = {
  'Futcrunch': 'FutCrunch',
  'EYstreem': 'Eystreem',
  'Amp World': 'AMP',
  "WHAT'S INSIDE? FAMILY": "What's Inside",
  'Noluvmar': 'NoLuvMar',
  'Aj Shabeel': 'AJ Shabeel',
};

// Secondary/alternate channels -> their main board channel (user-confirmed groupings,
// July 21: "link the names between their main channels n secondary ones").
// VIDEO attribution only — subs always come from the main channel, never a secondary.
export const CHANNEL_GROUPS = {
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

// credits.json name -> the name the source API uses (inverse of CANON)
export const ALIASES = Object.fromEntries(Object.entries(CANON).map(([source, ours]) => [ours, source]));

export const norm = (s) => String(s || '').trim().toLowerCase();

// Case-insensitive lookup so "cashblox", "CashBlox" and "CASHBLOX" all resolve to Cash.
const LOOKUP = new Map();
for (const [from, to] of Object.entries(CANON)) LOOKUP.set(norm(from), to);
for (const [from, to] of Object.entries(CHANNEL_GROUPS)) LOOKUP.set(norm(from), to);

export const canonClient = (channelName) => {
  const raw = String(channelName || '').trim();
  if (!raw) return null;
  return LOOKUP.get(norm(raw)) || raw;
};

// Names in credits.json that no source API can supply subscriber counts for —
// their values are Gregor's own and must never be zeroed or guessed (AGENTS.md).
export const NO_SOURCE_CHANNELS = new Set(['SSSniperWolf', 'LawByMike', 'Cash']);

// Typhon's hand-confirmed attributions (July 21) — authoritative; override the API on conflict.
export const MANUAL = {
  'g33J4cIIBeo': 'Ben Azelart',
  'JPcqJDMdSPs': 'Preston', '3PZwPRNnPbU': 'Preston', 'mcj-r27uutU': 'Preston',
  'FHF1CNBdBmI': 'FutCrunch',
  'X5kAQTXC-cI': 'Unspeakable', 'ubPMZjJWUns': 'Unspeakable', 'Nx-oA7bsuCY': 'Unspeakable',
  'ZesUFz6tZZc': 'Unspeakable', '_rO1pVAR_rc': 'Unspeakable', 'Uq3-7nrC8gI': 'Unspeakable',
  'Z-KufbXkdMY': 'Unspeakable', 'czXZpCKy1Lg': 'Unspeakable', 'WU05jZnUiYs': 'Unspeakable',
  '32gBph9s-Bc': 'Unspeakable', '6p6m2fwJVmg': 'Unspeakable', 'D5bulg60vvw': 'Unspeakable',
  'Mu4izZLKma8': 'Unspeakable', 'jtEDlRA179Y': 'Unspeakable',
};

// 354478255 -> "354.48M", matching YTJobs' own abbreviation style.
export const abbreviate = (n) => {
  const v = Number(n) || 0;
  const unit = v >= 1e9 ? ['B', 1e9] : v >= 1e6 ? ['M', 1e6] : v >= 1e3 ? ['K', 1e3] : ['', 1];
  if (unit[1] === 1) return String(v);
  return (Math.round((v / unit[1]) * 100) / 100).toFixed(2).replace(/\.?0+$/, '') + unit[0];
};
