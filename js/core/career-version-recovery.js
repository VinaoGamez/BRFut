import { SAVE_KEYS, SAVE_VERSION, CAREER_INDEX_KEY, SAVE_RESET_EPOCH, SAVE_RESET_MARKER_KEY, slotBundleKeys, isSlotBundleKey } from './constants.js';

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}

// 0.2.2 created v7 payloads after the v8 calendar migration. Only upgrade
// when the saved Série C schedule proves it already uses a single round robin.
export function canRecoverMislabeledCareer(career, season, epoch) {
  if (career?.version !== 7 || epoch !== SAVE_RESET_EPOCH) return false;
  if (career.freshWorld === true && !season) return true;
  if (!season || season.seed !== career.seed || season._localCheckpoint) return false;
  const rounds = season.nationalFixtures?.C;
  if (!Array.isArray(rounds) || !rounds.length) return false;
  const teams = new Set();
  const pairs = new Set();
  for (const round of rounds) {
    if (!Array.isArray(round) || !round.length) return false;
    for (const game of round) {
      if (!game?.home || !game.away || game.home === game.away) return false;
      teams.add(game.home); teams.add(game.away);
      const pair = JSON.stringify([game.home, game.away].sort());
      if (pairs.has(pair)) return false;
      pairs.add(pair);
    }
  }
  const size = teams.size;
  return size >= 20 && size <= 28 && size % 2 === 0
    && rounds.length === size - 1 && pairs.size === size * (size - 1) / 2;
}

export function careerRecoveryIdentity(career) {
  if (career?.seed == null || !career?.clubName) return null;
  return JSON.stringify([career.seed, career.foundingClubName || career.clubName, career.createdAt || null]);
}

/** Non-destructive: original bundles stay on disk, including duplicate aliases. */
export function recoverMislabeledCareerVersions(storage = localStorage) {
  const epoch = storage.getItem(SAVE_RESET_MARKER_KEY);
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  let upgraded = 0;
  for (const key of keys) {
    if (key !== SAVE_KEYS.career && !(isSlotBundleKey(key) && key.endsWith('-career'))) continue;
    const career = read(storage, key);
    const seasonKey = key === SAVE_KEYS.career ? SAVE_KEYS.season : key.replace(/-career$/, '-season');
    if (!canRecoverMislabeledCareer(career, read(storage, seasonKey), epoch)) continue;
    try {
      storage.setItem(key, JSON.stringify({ ...career, version: SAVE_VERSION.career }));
      upgraded++;
    } catch { /* Keep the original payload if the write fails. */ }
  }
  const index = read(storage, CAREER_INDEX_KEY) || { version: 2, saveEpoch: SAVE_RESET_EPOCH, slots: [] };
  const slots = Array.isArray(index.slots) ? [...index.slots] : [];
  const knownIds = new Set(slots.map(slot => slot.id));
  const identities = new Set(slots.map(slot => careerRecoveryIdentity(read(storage, slotBundleKeys(slot.id).career))).filter(Boolean));
  const candidates = keys.filter(key => isSlotBundleKey(key) && key.endsWith('-career'))
    .map(key => ({ id: key.slice('brfut-slot-'.length, -'-career'.length), career: read(storage, key) }))
    .filter(({ career }) => career?.version >= SAVE_VERSION.career)
    .sort((a, b) => String(b.career.updatedAt || '').localeCompare(String(a.career.updatedAt || '')));
  let recovered = 0;
  for (const { id, career } of candidates) {
    const identity = careerRecoveryIdentity(career);
    if (knownIds.has(id) || (identity && identities.has(identity))) continue;
    const season = read(storage, slotBundleKeys(id).season);
    slots.push({ id, name: `${career.clubName} ${career.season}`, clubName: career.clubName,
      division: career.division, managerName: career.managerName || '', seasonYear: season?.careerSeason ?? career.season,
      currentRound: season?.currentRound ?? null, pendingCreation: false,
      createdAt: career.createdAt, updatedAt: career.updatedAt });
    knownIds.add(id);
    if (identity) identities.add(identity);
    recovered++;
  }
  if (recovered) {
    try { storage.setItem(CAREER_INDEX_KEY, JSON.stringify({ ...index, slots, activeSlotId: index.activeSlotId || slots[0]?.id })); }
    catch { return { upgraded, recovered: 0 }; }
  }
  return { upgraded, recovered };
}

/** Alias slots caused by the v7 bug may contain the original IndexedDB rows. */
export function careerRecoveryAliases(slotId, storage = localStorage) {
  const career = read(storage, slotBundleKeys(slotId).career);
  const identity = careerRecoveryIdentity(career);
  const ids = new Set([slotId]);
  if (identity) for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (isSlotBundleKey(key) && key.endsWith('-career') && careerRecoveryIdentity(read(storage, key)) === identity) {
      ids.add(key.slice('brfut-slot-'.length, -'-career'.length));
    }
  }
  return [...ids].filter(Boolean);
}
