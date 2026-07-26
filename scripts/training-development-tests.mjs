import {
  applyDevelopmentTrainingDay,
  normalizeTrainingRules,
  finalizeWeeklyTrainingReport,
  emptyWeeklyTrainingReport,
  DEVELOPMENT_FOCUSES,
  XP_PER_ATTR_POINT,
  formatRosterTrainingXpHtml,
  getTrainingProgressForPlayer,
  trainingAttrGainTotal,
} from '../js/engine/training-development.js';
import { syncOverallFromAttributes } from '../js/engine/player-generation.js';
import { emptyDevelopmentState } from '../js/engine/player-development.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const reserve = {
  name: 'Reserva Teste',
  pos: 'ATA',
  age: 20,
  overall: 62,
  potential: 78,
  fatigue: 80,
  finishing: 58,
  heading: 55,
  speed: 60,
  dribble: 57,
  passing: 54,
  marking: 40,
  tackling: 38,
};

const starter = {
  name: 'Titular Teste',
  pos: 'MC',
  age: 28,
  overall: 70,
  potential: 72,
  fatigue: 45,
  passing: 68,
  dribble: 66,
  tackling: 64,
  finishing: 60,
  speed: 62,
  marking: 58,
  heading: 55,
};

ok(normalizeTrainingRules({}).freeMode === 'load', 'default freeMode load');
ok(DEVELOPMENT_FOCUSES.finishing.label === 'Finalização', 'focus label');

const state = emptyDevelopmentState(2026);
const beforeFin = reserve.finishing;
const result = applyDevelopmentTrainingDay({
  roster: [reserve],
  focus: 'finishing',
  state,
  getPlayerId: p => p.name,
  getSeasonMinutes: () => 0,
  institutionRecovery: 1,
  careerDate: new Date(2026, 2, 10),
});

ok(result.dayApplied, 'day applied');
ok(result.totalXp > 0, 'xp granted');
ok(reserve.fatigue < 80, 'fatigue cost applied');

const daysNeeded = Math.ceil(XP_PER_ATTR_POINT / (result.totalXp || 1)) + 1;
let gained = false;
for (let i = 0; i < daysNeeded; i += 1) {
  reserve.fatigue = 85;
  const day = applyDevelopmentTrainingDay({
    roster: [reserve],
    focus: 'finishing',
    state,
    getPlayerId: p => p.name,
    getSeasonMinutes: () => 0,
    institutionRecovery: 1,
    careerDate: new Date(2026, 2, 10 + i),
  });
  if (day.gains?.length) gained = true;
}
ok(gained || reserve.finishing > beforeFin, 'reserve gains finishing over sessions');
ok(reserve.overall >= 62, 'ovr never drops from training');

const sync = syncOverallFromAttributes({ ...reserve });
ok(sync.applied >= 0, 'sync non-negative');

const blocked = applyDevelopmentTrainingDay({
  roster: [{ ...starter, fatigue: 20 }],
  focus: 'passing',
  state,
  getPlayerId: p => p.name,
  getSeasonMinutes: () => 500,
  institutionRecovery: 1,
});
ok(blocked.blockedCount === 1, 'low energy blocks training');

const report = finalizeWeeklyTrainingReport(
  {
    ...emptyWeeklyTrainingReport(),
    days: 3,
    gains: [{ playerName: 'Reserva Teste', attrLabel: 'Fin', attrDelta: 1, ovrDelta: 1 }],
  },
  normalizeTrainingRules({ freeMode: 'development', developmentFocus: 'finishing' }),
);
ok(report.body.includes('Desenvolvimento'), 'weekly report mentions development mode');
ok(report.body.includes('Reserva Teste'), 'weekly report lists player');

const progress = getTrainingProgressForPlayer(state, 'Reserva Teste');
ok(progress && Number(progress.xpSeason) >= 0, 'training progress stored');
const idleHtml = formatRosterTrainingXpHtml(progress, { active: false });
ok(idleHtml.includes('is-idle'), 'idle xp html when load mode');
const activeHtml = formatRosterTrainingXpHtml(progress, { active: true });
ok(activeHtml.includes('roster-training-xp') && activeHtml.includes('em>'), 'active xp bar html');
ok(trainingAttrGainTotal(progress) >= 0, 'attr gain total');

console.log('training-development-tests: all passed');
