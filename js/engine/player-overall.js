/** Permanent capacity: attributes are authoritative; OVR is only a derived label. */
export const OVERALL_MODEL_VERSION = 1;
const BASE = {
  GOL: { positioning: .32, reflexes: .36, penaltySaving: .18, passing: .06, speed: .04, playmaking: .04 },
  ZAG: { marking: .25, tackling: .25, heading: .18, speed: .10, passing: .09, dribble: .04 },
  LAT: { speed: .22, marking: .17, tackling: .17, passing: .14, dribble: .13, heading: .05, finishing: .04 },
  VOL: { tackling: .20, marking: .18, passing: .18, heading: .11, speed: .08, dribble: .07, finishing: .05 },
  MC: { passing: .24, dribble: .15, tackling: .12, finishing: .11, speed: .10, marking: .08, heading: .05 },
  MEI: { passing: .23, dribble: .22, finishing: .16, speed: .12, heading: .05, marking: .03, tackling: .03 },
  PE: { dribble: .23, speed: .22, finishing: .20, passing: .13, heading: .05, marking: .03, tackling: .02 },
  PD: { dribble: .23, speed: .22, finishing: .20, passing: .13, heading: .05, marking: .03, tackling: .02 },
  ATA: { finishing: .29, heading: .18, speed: .16, dribble: .14, passing: .07, marking: .02, tackling: .02 },
};
// Design weights from the attribute-first experiment, not real-world ratings.
const EXTRAS = {
  GOL: {}, ZAG: { playmaking: .04 }, LAT: { playmaking: .08, freeKick: .02 },
  VOL: { playmaking: .08, freeKick: .02 },
  MC: { playmaking: .15, freeKick: .02, penaltyTaking: .02 },
  MEI: { playmaking: .15, freeKick: .02, penaltyTaking: .02 },
  PE: { playmaking: .08, freeKick: .02, penaltyTaking: .02 },
  PD: { playmaking: .08, freeKick: .02, penaltyTaking: .02 },
  ATA: { playmaking: .04, freeKick: .02, penaltyTaking: .02 },
};
export const OVERALL_WEIGHTS = Object.freeze(Object.fromEntries(Object.entries(BASE).map(([pos, base]) => {
  const sum = Object.values(base).reduce((a, b) => a + b, 0);
  const extra = EXTRAS[pos], reserved = Object.values(extra).reduce((a, b) => a + b, 0);
  const weights = Object.fromEntries(Object.entries(base).map(([key, weight]) => [key, weight / sum * (1 - reserved)]));
  for (const [key, weight] of Object.entries(extra)) weights[key] = (weights[key] || 0) + weight;
  return [pos, Object.freeze(weights)];
})));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const overallWeights = player => OVERALL_WEIGHTS[player?.pos] || OVERALL_WEIGHTS.MC;

export function calculatePlayerOverall(player) {
  const score = Object.entries(overallWeights(player)).reduce((sum, [key, weight]) =>
    sum + clamp(Number(player?.[key]) || 0, 0, 99) * weight, 0);
  return clamp(score, 1, 99);
}

export function syncPlayerOverall(player) {
  if (!player?.pos) return { before: 0, after: 0, applied: 0 };
  const before = Number(player.overall) || 0;
  player.overallRaw = calculatePlayerOverall(player);
  player.overall = Math.round(player.overallRaw);
  player.overallModelVersion = OVERALL_MODEL_VERSION;
  return { before, after: player.overall, applied: player.overall - before };
}

/** Check an attribute BEFORE applying it: never clamp just the displayed OVR. */
export function canDevelopAttribute(player, key, amount = 1, ceiling = player?.potential) {
  if (!(Number(player?.[key]) + amount <= 99)) return false;
  const before = calculatePlayerOverall(player);
  const after = calculatePlayerOverall({ ...player, [key]: Number(player[key]) + amount });
  const cap = Number.isFinite(Number(ceiling)) ? Number(ceiling) : 99;
  return after <= Math.max(before, cap) + 1e-9;
}

/** Apply generation budgets to attributes, not an unrelated OVR field. */
export function limitAttributesToOverall(player, ceiling) {
  const keys = Object.entries(overallWeights(player)).sort((a, b) => b[1] - a[1]).map(([key]) => key);
  let cursor = 0;
  while (calculatePlayerOverall(player) > ceiling + 1e-9 && cursor < 20000) {
    const key = keys[cursor++ % keys.length];
    if (Number(player[key]) > 1) player[key] = Math.max(1, player[key] - 1);
  }
  return syncPlayerOverall(player);
}

export function raiseAttributesToOverall(player, floor) {
  const keys = Object.entries(overallWeights(player)).sort((a, b) => b[1] - a[1]).map(([key]) => key);
  let cursor = 0;
  while (calculatePlayerOverall(player) < floor - 1e-9 && cursor < 20000) {
    const key = keys[cursor++ % keys.length];
    if (Number(player[key]) < 99) player[key] = Math.min(99, player[key] + 1);
  }
  return syncPlayerOverall(player);
}

/** One-time legacy reconciliation preserves attributes, names and player IDs. */
export function ensurePlayerOverall(player) {
  if (!player?.pos) return;
  const legacy = player.overallModelVersion !== OVERALL_MODEL_VERSION;
  syncPlayerOverall(player);
  if (legacy) player.potential = Math.max(Number(player.potential) || 0, Math.ceil(player.overallRaw));
}
