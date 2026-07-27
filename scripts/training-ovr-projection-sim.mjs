/**
 * Projeção de evolução de OVR via treinamento + pulsos de calendário.
 * Uso: node scripts/training-ovr-projection-sim.mjs
 */
import {
  applyDevelopmentTrainingDay,
  BASE_TRAINING_XP,
  XP_PER_ATTR_POINT,
  DEVELOPMENT_FOCUSES,
} from '../js/engine/training-development.js';
import {
  emptyDevelopmentState,
  computePulseDelta,
  runDevelopmentPulse,
  PULSE_IDS,
} from '../js/engine/player-development.js';
import { syncOverallFromAttributes } from '../js/engine/player-generation.js';

const clone = player => JSON.parse(JSON.stringify(player));

const ARCHETYPES = [
  {
    id: 'u20-reserva',
    label: 'U20 reserva (0 min)',
    focus: 'finishing',
    minutes: 0,
    player: {
      name: 'U20 Reserva',
      pos: 'ATA',
      age: 20,
      overall: 62,
      potential: 78,
      fatigue: 85,
      finishing: 58,
      heading: 55,
      speed: 60,
      dribble: 57,
      passing: 54,
      marking: 40,
      tackling: 38,
    },
  },
  {
    id: 'u20-titular',
    label: 'U20 titular (~500 min, nota 7.2)',
    focus: 'individual',
    minutes: 500,
    player: {
      name: 'U20 Titular',
      pos: 'MEI',
      age: 20,
      overall: 68,
      potential: 82,
      fatigue: 85,
      passing: 66,
      dribble: 67,
      finishing: 63,
      speed: 65,
      marking: 48,
      tackling: 45,
      heading: 50,
    },
  },
  {
    id: 'prime-reserva',
    label: '25 anos reserva (0 min)',
    focus: 'passing',
    minutes: 0,
    player: {
      name: 'Prime Reserva',
      pos: 'MC',
      age: 25,
      overall: 70,
      potential: 76,
      fatigue: 85,
      passing: 68,
      dribble: 66,
      tackling: 64,
      finishing: 60,
      speed: 62,
      marking: 58,
      heading: 55,
    },
  },
  {
    id: 'prime-titular',
    label: '28 anos titular (~900 min, nota 7.0)',
    focus: 'defense',
    minutes: 900,
    player: {
      name: 'Prime Titular',
      pos: 'ZAG',
      age: 28,
      overall: 74,
      potential: 76,
      fatigue: 85,
      marking: 73,
      tackling: 72,
      heading: 71,
      speed: 65,
      passing: 62,
      dribble: 55,
      finishing: 48,
    },
  },
  {
    id: 'veterano',
    label: '33 anos reserva (120 min)',
    focus: 'individual',
    minutes: 120,
    player: {
      name: 'Veterano',
      pos: 'VOL',
      age: 33,
      overall: 71,
      potential: 71,
      fatigue: 85,
      tackling: 70,
      marking: 69,
      passing: 68,
      heading: 66,
      speed: 60,
      dribble: 58,
      finishing: 55,
    },
  },
];

const FREE_DAY_SCENARIOS = [30, 60, 90, 120, 150, 180];

function trainSeason(player, focus, minutes, freeDays, state) {
  const startOvr = player.overall;
  let firstOvrDay = null;
  let ovrEvents = 0;
  let attrPoints = 0;
  let totalXp = 0;
  let blockedDays = 0;
  const careerDate = new Date(2026, 0, 15);

  for (let day = 0; day < freeDays; day += 1) {
    player.fatigue = Math.min(100, (Number(player.fatigue) || 0) + 12);
    if (player.fatigue < 70) player.fatigue = 85;

    const before = player.overall;
    const result = applyDevelopmentTrainingDay({
      roster: [player],
      focus,
      state,
      getPlayerId: p => p.name,
      getSeasonMinutes: () => minutes,
      institutionRecovery: 1,
      careerDate: new Date(careerDate.getTime() + day * 86400000),
    });

    totalXp += result.totalXp || 0;
    blockedDays += result.blockedCount || 0;
    attrPoints += (result.gains || []).reduce((sum, g) => sum + (g.attrDelta || 0), 0);
    if (player.overall > before) {
      ovrEvents += 1;
      if (firstOvrDay == null) firstOvrDay = day + 1;
    }
  }

  const progress = state.trainingByPlayer?.[player.name] || {};
  return {
    startOvr,
    endOvr: player.overall,
    deltaOvr: player.overall - startOvr,
    firstOvrDay,
    ovrEvents,
    attrPoints,
    totalXp,
    blockedDays,
    ovrFromTraining: progress.ovrFromTraining || 0,
    xpSeason: progress.xpSeason || 0,
    attrGains: { ...(progress.attrGains || {}) },
  };
}

function simulatePulses(player, minutes, avgRating, starts) {
  const club = { roster: [player] };
  const state = emptyDevelopmentState(2026);
  const bucket = {
    minutes,
    starts,
    ratingSum: avgRating * Math.max(1, starts),
    ratingCount: Math.max(1, starts),
  };
  const getSeasonBucket = () => bucket;
  let pulseDelta = 0;
  const pulseResults = [];

  for (const pulseId of Object.values(PULSE_IDS)) {
    const p = clone(player);
    const clubs = { user: { roster: [p] } };
    const st = emptyDevelopmentState(2026);
    st.yearDeltaByPlayer[p.name] = pulseDelta;
    const result = runDevelopmentPulse({
      clubs,
      pulseId,
      season: 2026,
      state: st,
      getSeasonBucket: () => bucket,
      date: new Date(2026, 5, 1),
    });
    const applied = (Number(p.overall) || 0) - (Number(player.overall) || 0);
    pulseResults.push({ pulseId, delta: applied, changed: result.changed });
    pulseDelta += applied;
    Object.assign(player, p);
  }

  return { pulseDelta, pulseResults };
}

function estimateDailyXp(player, focus, minutes) {
  const result = applyDevelopmentTrainingDay({
    roster: [clone(player)],
    focus,
    state: emptyDevelopmentState(2026),
    getPlayerId: p => p.name,
    getSeasonMinutes: () => minutes,
    institutionRecovery: 1,
  });
  return result.totalXp || 0;
}

console.log('=== Treinamento · parâmetros atuais ===');
console.log(`BASE_TRAINING_XP=${BASE_TRAINING_XP} · XP/atributo=${XP_PER_ATTR_POINT}`);
console.log('Cenários de dias livres (modo Desenvolvimento todos os dias livres)\n');

const rows = [];

for (const archetype of ARCHETYPES) {
  const dailyXp = estimateDailyXp(archetype.player, archetype.focus, archetype.minutes);
  const daysPerAttr = dailyXp > 0 ? (XP_PER_ATTR_POINT / dailyXp).toFixed(1) : '—';

  console.log(`--- ${archetype.label} · foco ${DEVELOPMENT_FOCUSES[archetype.focus].label} ---`);
  console.log(`XP/dia ≈ ${dailyXp.toFixed(1)} · ~${daysPerAttr} dias livres por +1 atributo`);

  for (const freeDays of FREE_DAY_SCENARIOS) {
    const player = clone(archetype.player);
    const state = emptyDevelopmentState(2026);
    const r = trainSeason(player, archetype.focus, archetype.minutes, freeDays, state);
    rows.push({ archetype: archetype.id, freeDays, ...r });
    if ([60, 120, 180].includes(freeDays)) {
      console.log(
        `  ${String(freeDays).padStart(3)} dias livres → OVR ${r.startOvr}→${r.endOvr} (+${r.deltaOvr})` +
          `${r.firstOvrDay ? ` · 1º OVR no dia ${r.firstOvrDay}` : ' · sem subida OVR'}` +
          ` · attrs +${r.attrPoints} · teto treino ovrFromTraining=${r.ovrFromTraining}`,
      );
    }
  }

  const pulsePlayer = clone(archetype.player);
  const good = simulatePulses(pulsePlayer, archetype.minutes || 720, 7.4, 8);
  const weak = simulatePulses(clone(archetype.player), 200, 6.0, 2);
  console.log(
    `  Pulsos temporada (4x): titular forte +${good.pulseDelta} OVR · poucos minutos +${weak.pulseDelta} OVR`,
  );
  console.log('');
}

console.log('=== Prognóstico (temporada típica) ===');
console.log('Estimativa calendário: ~120–160 dias livres/ano se avançar semana a semana com 1 jogo.');
console.log('');

const typical = rows.filter(r => r.freeDays === 150);
let maxTrainDelta = 0;
let fastFirst = Infinity;
for (const r of typical) {
  maxTrainDelta = Math.max(maxTrainDelta, r.deltaOvr);
  if (r.firstOvrDay) fastFirst = Math.min(fastFirst, r.firstOvrDay);
}

console.log('No cenário 150 dias livres (Desenvolvimento constante):');
for (const archetype of ARCHETYPES) {
  const r = typical.find(x => x.archetype === archetype.id);
  if (!r) continue;
  console.log(
    `  ${archetype.label}: +${r.deltaOvr} OVR treino` +
      `${r.firstOvrDay ? ` (1ª subida ~${Math.round((r.firstOvrDay / 150) * 26)} semanas)` : ''}`,
  );
}

console.log('');
console.log('Tetos por sistema (por jogador/temporada):');
console.log('  Treino: U22 +2 OVR · 23–26 +1 · 27–32 +1 · 33+ +0 (ovrFromTraining)');
console.log('  Pulsos (partidas): U22 até +3 OVR/ano · 23–25 +2 · 26–32 +1 (desempenho)');
console.log('  Combinado (teto teórico jovem estrela): até ~+5 OVR/ano (treino + pulsos)');
console.log('');
console.log('Diagnóstico:');
if (maxTrainDelta >= 2 && fastFirst <= 25) {
  console.log('  ⚠ Treino acelera OVR cedo demais para reservas/jovens — 1º salto em ~2–4 semanas de calendário.');
  console.log('  ⚠ Reservas ganham +20% XP (0 min) vs titulares — incentiva stack no banco.');
  console.log('  ⚠ Cada +1 atributo pode puxar OVR via syncOverall; caps de treino (+2) limitam, mas attrs continuam.');
} else {
  console.log('  Ritmo moderado no cenário médio; verificar se usuário avança calendário em blocos grandes.');
}
console.log('');
console.log('Sugestões de balanceamento (referência):');
console.log('  · XP_PER_ATTR_POINT 100 → 130–150 (mais lento)');
console.log('  · minutesMultiplier(0 min) 1.2 → 1.0 (reserva não acima do titular)');
console.log('  · maxOvr U22 2 → 1 no treino anual');
console.log('  · Exigir ≥90 min na temporada para treino contar no teto de OVR');
