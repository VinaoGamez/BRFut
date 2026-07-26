/** Simula conversão da disputa — node scripts/shootout-conversion-sim.mjs */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const SHOOTOUT_TUNING = {
  wideBase: 0.035,
  wideSkillDivisor: 480,
  wideMin: 0.02,
  wideMax: 0.055,
  goalBase: 0.84,
  skillGapDivisor: 130,
  skillBiasDivisor: 360,
  goalMin: 0.72,
  goalMax: 0.96,
};

function shootoutWideChance(skill) {
  return clamp(
    SHOOTOUT_TUNING.wideBase - (skill - 70) / SHOOTOUT_TUNING.wideSkillDivisor,
    SHOOTOUT_TUNING.wideMin,
    SHOOTOUT_TUNING.wideMax,
  );
}

function shootoutGoalChanceRate(skill, saving) {
  return clamp(
    SHOOTOUT_TUNING.goalBase +
      (skill - saving) / SHOOTOUT_TUNING.skillGapDivisor +
      (skill - 70) / SHOOTOUT_TUNING.skillBiasDivisor,
    SHOOTOUT_TUNING.goalMin,
    SHOOTOUT_TUNING.goalMax,
  );
}

function resolveKick(skill, saving) {
  if (Math.random() < shootoutWideChance(skill)) return false;
  return Math.random() < shootoutGoalChanceRate(skill, saving);
}

function simulate(label, skillFn, saving = 72, n = 20000) {
  let goals = 0;
  for (let i = 0; i < n; i++) {
    if (resolveKick(skillFn(), saving)) goals++;
  }
  console.log(`${label}: ${((goals / n) * 100).toFixed(1)}%`);
}

simulate('skill 70 / saving 72', () => 70);
simulate('skill 40 / saving 72', () => 40);
simulate('skill mix 35-75', () => 35 + Math.random() * 40);
simulate('Série D roster mix', () => {
  const roles = ['ZAG', 'ZAG', 'LAT', 'LAT', 'VOL', 'MC', 'MC', 'PE', 'PD', 'ATA'];
  const role = roles[Math.floor(Math.random() * roles.length)];
  const ovr = 48 + Math.random() * 22;
  const bias = ['MC', 'MEI', 'PE', 'PD', 'ATA'].includes(role) ? -3 : -8;
  return clamp(ovr + bias + (Math.random() * 10 - 5), 12, 85);
});
