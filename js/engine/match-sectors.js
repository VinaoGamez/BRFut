/** Task exposure, not extra skill or an OVR bonus. Shared by both match engines. */
export const SECTOR_WEIGHTS = Object.freeze({
  attack: Object.freeze({ GOL: 0, ZAG: .05, LAT: .2, VOL: .15, MC: .35, MEI: .7, PE: .8, PD: .8, ATA: 1 }),
  passing: Object.freeze({ GOL: .1, ZAG: .25, LAT: .5, VOL: .8, MC: 1, MEI: 1, PE: .6, PD: .6, ATA: .25 }),
  defense: Object.freeze({ GOL: 0, ZAG: 1, LAT: .8, VOL: .8, MC: .4, MEI: .15, PE: .1, PD: .1, ATA: .05 }),
});

/** Preserve uniform means for global OVR and fatigue; missing sectors are safe. */
export function sectorAverage(roster, key, sector = 'attack', stat = (player, attr) => Number(player?.[attr]) || 0, condition = () => 1) {
  let sum = 0, total = 0;
  for (const player of roster || []) {
    const weight = key === 'overall' || key === 'fatigue' ? 1 : (SECTOR_WEIGHTS[sector]?.[player.pos] ?? 0);
    sum += stat(player, key) * condition(player) * weight;
    total += weight;
  }
  return total > 0 ? sum / total : 0;
}

export function sectorParticipation(player, action) {
  if (action === 'save') return 1;
  const sector = action === 'pass' || action === 'passing' ? 'passing'
    : ['tackle', 'foul', 'defense'].includes(action) ? 'defense' : 'attack';
  return SECTOR_WEIGHTS[sector][player?.pos] ?? .1;
}
