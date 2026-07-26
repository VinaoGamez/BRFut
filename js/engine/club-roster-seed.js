/** Seed determinística para elencos regionais (sem deps pesadas). */

export function rosterSeedKey(careerSeed, clubName, seasonYear) {
  return `${Number(careerSeed) || 0}|${String(clubName || '').trim()}|${Number(seasonYear) || 2026}`;
}

export function hashSeedString(text) {
  let h = 2166136261 >>> 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
