/**
 * Simulação de temporada — elenco inteiro, treino + descanso + pulsos.
 * Uso: node scripts/season-training-sim.mjs
 */
import { generatePlayer, generateSquad, generatedOverall, playerAttributesForOverall } from '../js/engine/player-generation.js';
import {
  applyDevelopmentTrainingDay,
  normalizeTrainingRules,
  XP_PER_ATTR_POINT,
  BASE_TRAINING_XP,
} from '../js/engine/training-development.js';
import {
  emptyDevelopmentState,
  runDevelopmentPulse,
  PULSE_IDS,
  dueCalendarPulses,
} from '../js/engine/player-development.js';
import { ensurePlayerId } from '../js/engine/player-identity.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const TRAINING_RECOVERY = {
  before: { 'Preparação tática': 1, 'Treino leve': 0.94, Descanso: 1.06 },
  after: { Recuperação: 1.18, 'Descanso total': 1.3, 'Análise do jogo': 1.06 },
  free: { 'Treino equilibrado': 1, 'Treino técnico': 0.96, 'Descanso intermitente': 1.08 },
};

const dailyRecovery = age =>
  age <= 22 ? 6.5 : age <= 26 ? 5.5 : age <= 29 ? 4.5 : age <= 32 ? 3.5 : 2.5;

const recoveryMod = (type, rules) => TRAINING_RECOVERY[type]?.[rules[type]] ?? 1;

function applyLoadDay(player, type, rules, institutionRecovery = 1) {
  const mod = recoveryMod(type, rules);
  const rec = dailyRecovery(player.age) * institutionRecovery * mod;
  if (type === 'before') {
    player.fatigue = clamp(player.fatigue + (mod - 1) * 5 - (mod < 1 ? (1 - mod) * 4 : 0), 0, 100);
  } else {
    player.fatigue = clamp(player.fatigue + rec, 0, 100);
  }
}

function buildSeasonCalendar({ seasonStart = new Date(2026, 0, 4), rounds = 38, matchWeekday = 0 } = {}) {
  const days = [];
  let cursor = new Date(seasonStart);
  cursor.setHours(12, 0, 0, 0);
  while (cursor.getDay() !== matchWeekday) cursor.setDate(cursor.getDate() + 1);

  for (let round = 1; round <= rounds; round += 1) {
    const matchDate = new Date(cursor);
    const before = new Date(matchDate);
    before.setDate(before.getDate() - 1);
    const after = new Date(matchDate);
    after.setDate(after.getDate() + 1);
    days.push({ round, date: new Date(matchDate), kind: 'match' });
    days.push({ round, date: before, kind: 'before' });
    days.push({ round, date: after, kind: 'after' });
    const freeStart = new Date(after);
    freeStart.setDate(freeStart.getDate() + 1);
    const nextBefore = new Date(matchDate);
    nextBefore.setDate(nextBefore.getDate() + 6);
    for (let d = new Date(freeStart); d < nextBefore; d.setDate(d.getDate() + 1)) {
      days.push({ round, date: new Date(d), kind: 'free' });
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return days.sort((a, b) => a.date - b.date);
}

/** Perfil de minutos por jogador (titular / rotação / reserva). */
function assignSquadProfiles(roster, { seed = 1 } = {}) {
  const sorted = [...roster].sort((a, b) => b.overall - a.overall);
  const avgOvr = sorted.reduce((s, p) => s + p.overall, 0) / sorted.length;

  sorted.forEach((player, rank) => {
    ensurePlayerId(player, { seed: seed + rank, club: 'sim', index: rank });
    player.fatigue = clamp(78 + (rank % 5) * 3, 70, 92);

    if (rank < 11) {
      player._profile = 'titular';
      player._minsPerGame = 78 + (rank % 4) * 2;
      player._gamesRate = 1;
      player._rating = clamp(6.4 + (player.overall - avgOvr) * 0.06 + (rank % 3) * 0.1, 6.0, 8.2);
    } else if (rank < 16) {
      player._profile = 'rotação';
      player._minsPerGame = 28 + (rank % 4) * 5;
      player._gamesRate = 0.45;
      player._rating = clamp(6.5 + (player.overall - avgOvr) * 0.04, 6.0, 7.5);
    } else {
      player._profile = 'reserva';
      player._minsPerGame = player.age <= 22 ? 0 : 12 + (rank % 3) * 8;
      player._gamesRate = player.age <= 22 ? 0 : 0.15;
      player._rating = 6.6;
    }
  });
  return roster;
}

function ageBand(age) {
  if (age <= 20) return 'U20';
  if (age <= 22) return 'U22';
  if (age <= 25) return '23–25';
  if (age <= 28) return '26–28';
  if (age <= 32) return '29–32';
  return '33+';
}

function simulateSquadSeason({
  squadLabel,
  roster,
  freeMode = 'development',
  focus = 'individual',
  smartRest = false,
  hybridByProfile = false,
  rules: rulesOverride,
  rounds = 38,
  rngSeed = 777,
}) {
  const rules = rulesOverride ?? normalizeTrainingRules({
    before: 'Preparação tática',
    after: 'Recuperação',
    free: 'Treino equilibrado',
    freeMode,
    developmentFocus: focus,
  });

  const calendar = buildSeasonCalendar({ rounds });
  const state = emptyDevelopmentState(2026);
  const clubs = { user: { roster, name: 'User' } };

  const stats = new Map(
    roster.map(p => [
      p.playerId,
      {
        id: p.playerId,
        name: p.name.split(' ')[0] + ' ' + (p.name.split(' ').pop() || ''),
        pos: p.pos,
        age: p.age,
        band: ageBand(p.age),
        profile: p._profile,
        startOvr: p.overall,
        endOvr: p.overall,
        minutes: 0,
        games: 0,
        trainOvr: 0,
        pulseOvr: 0,
        attrs: 0,
        blocked: 0,
        devDays: 0,
        restDays: 0,
      },
    ]),
  );

  const minutesMap = new Map(roster.map(p => [p.playerId, 0]));
  const startsMap = new Map(roster.map(p => [p.playerId, 0]));
  const ratingMap = new Map(roster.map(p => [p.playerId, p._rating ?? 6.5]));

  const getBucket = playerId => {
    const starts = startsMap.get(playerId) || 0;
    const rating = ratingMap.get(playerId) || 6.5;
    return {
      minutes: minutesMap.get(playerId) || 0,
      starts,
      ratingSum: rating * starts,
      ratingCount: Math.max(1, starts),
    };
  };

  let squadFreeDev = 0;
  let squadFreeRest = 0;
  let rngState = rngSeed;
  const rng = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  for (const entry of calendar) {
    if (entry.kind === 'match') {
      roster.forEach(player => {
        const id = player.playerId;
        const played = rng() < (player._gamesRate ?? 0);
        if (!played) return;
        const mins = player._minsPerGame ?? 0;
        player.fatigue = clamp(player.fatigue - clamp(14 + mins * 0.1, 14, 28), 0, 100);
        minutesMap.set(id, (minutesMap.get(id) || 0) + mins);
        startsMap.set(id, (startsMap.get(id) || 0) + 1);
        const st = stats.get(id);
        st.minutes += mins;
        st.games += 1;
      });
      continue;
    }

    if (entry.kind === 'before' || entry.kind === 'after') {
      roster.forEach(p => applyLoadDay(p, entry.kind, rules));
      continue;
    }

    // Dia livre — elenco inteiro (como no jogo)
    const devRoster = [];
    roster.forEach(player => {
      const id = player.playerId;
      const st = stats.get(id);
      let useDev = freeMode === 'development';

      if (hybridByProfile) {
        useDev = player._profile !== 'titular';
      } else if (smartRest) {
        useDev = player.fatigue >= 50;
      }

      if (useDev) {
        st.devDays += 1;
        devRoster.push(player);
      } else {
        st.restDays += 1;
        applyLoadDay(player, 'free', rules);
      }
    });

    if (devRoster.length) {
      squadFreeDev += 1;
      const result = applyDevelopmentTrainingDay({
        roster: devRoster,
        focus,
        state,
        getPlayerId: p => p.playerId,
        getSeasonMinutes: p => minutesMap.get(p.playerId) || 0,
        institutionRecovery: 1,
        careerDate: entry.date,
      });
      devRoster.forEach(p => {
        if ((p.fatigue ?? 100) < 25) stats.get(p.playerId).blocked += 1;
      });
      if (result.blockedCount) {
        /* individual blocked tracked above */
      }
    } else {
      squadFreeRest += 1;
    }

    const due = dueCalendarPulses(entry.date, 2026, state.pulsesDone);
    for (const pulseId of due) {
      runDevelopmentPulse({
        clubs,
        pulseId,
        season: 2026,
        state,
        getSeasonBucket: (_p, id) => getBucket(id),
        date: entry.date,
      });
    }
  }

  runDevelopmentPulse({
    clubs,
    pulseId: PULSE_IDS.seasonEnd,
    season: 2026,
    state,
    getSeasonBucket: (_p, id) => getBucket(id),
    date: new Date(2026, 11, 15),
  });

  roster.forEach(player => {
    const id = player.playerId;
    const st = stats.get(id);
    const prog = state.trainingByPlayer?.[id] || {};
    st.endOvr = player.overall;
    st.trainOvr = prog.ovrFromTraining || 0;
    st.pulseOvr = Number(state.yearDeltaByPlayer?.[id]) || 0;
    st.attrs = Object.values(prog.attrGains || {}).reduce((a, b) => a + b, 0);
    st.totalDelta = st.endOvr - st.startOvr;
  });

  const rows = [...stats.values()].sort((a, b) => b.totalDelta - a.totalDelta || b.trainOvr - a.trainOvr);

  const agg = bands => {
    const out = {};
    bands.forEach(b => {
      out[b] = { count: 0, totalDelta: 0, train: 0, pulse: 0, attrs: 0 };
    });
    rows.forEach(r => {
      const key = bands.includes(r.band) ? r.band : 'other';
      if (!out[key]) out[key] = { count: 0, totalDelta: 0, train: 0, pulse: 0, attrs: 0 };
      out[key].count += 1;
      out[key].totalDelta += r.totalDelta;
      out[key].train += r.trainOvr;
      out[key].pulse += r.pulseOvr;
      out[key].attrs += r.attrs;
    });
    return out;
  };

  const byBand = agg(['U20', 'U22', '23–25', '26–28', '29–32', '33+']);
  const byProfile = {};
  ['titular', 'rotação', 'reserva'].forEach(prof => {
    const subset = rows.filter(r => r.profile === prof);
    byProfile[prof] = {
      count: subset.length,
      totalDelta: subset.reduce((s, r) => s + r.totalDelta, 0),
      train: subset.reduce((s, r) => s + r.trainOvr, 0),
      pulse: subset.reduce((s, r) => s + r.pulseOvr, 0),
      avgDelta: subset.length ? (subset.reduce((s, r) => s + r.totalDelta, 0) / subset.length).toFixed(2) : '0',
    };
  });

  return {
    squadLabel,
    rows,
    byBand,
    byProfile,
    squadFreeDev,
    squadFreeRest,
    squadTotalOvr: rows.reduce((s, r) => s + r.totalDelta, 0),
    squadTrainOvr: rows.reduce((s, r) => s + r.trainOvr, 0),
    squadPulseOvr: rows.reduce((s, r) => s + r.pulseOvr, 0),
    playersUp: rows.filter(r => r.totalDelta > 0).length,
  };
}

function mkSquad(seed, division = 'B', clubPower = 68) {
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const { roster } = generateSquad({ division, clubPower, random, squadSize: 22 });
  return assignSquadProfiles(roster, { seed });
}

function printPlayerTable(rows, limit = 22) {
  console.log(
    'Nome'.padEnd(14) +
      'Pos'.padStart(4) +
      'Id'.padStart(4) +
      'Perfil'.padStart(8) +
      'OVR'.padStart(7) +
      ' Δ'.padStart(4) +
      'Tre'.padStart(4) +
      'Jog'.padStart(4) +
      'Min'.padStart(5) +
      'At'.padStart(4),
  );
  console.log('─'.repeat(58));
  rows.slice(0, limit).forEach(r => {
    console.log(
      r.name.slice(0, 13).padEnd(14) +
        r.pos.padStart(4) +
        String(r.age).padStart(4) +
        r.profile.slice(0, 7).padStart(8) +
        `${r.startOvr}→${r.endOvr}`.padStart(7) +
        `+${r.totalDelta}`.padStart(4) +
        `+${r.trainOvr}`.padStart(4) +
        `+${r.pulseOvr}`.padStart(4) +
        String(r.minutes).padStart(5) +
        `+${r.attrs}`.padStart(4),
    );
  });
}

function printBandSummary(byBand) {
  console.log('\n  Faixa etária   n   ΣΔOVR  Σtreino  Σjogos  méd Δ');
  console.log('  ' + '─'.repeat(48));
  Object.entries(byBand).forEach(([band, v]) => {
    if (!v.count) return;
    const avg = (v.totalDelta / v.count).toFixed(2);
    console.log(
      `  ${band.padEnd(12)} ${String(v.count).padStart(2)}   +${String(v.totalDelta).padStart(3)}     +${String(v.train).padStart(3)}    +${String(v.pulse).padStart(3)}   +${avg}`,
    );
  });
}

// ─── Execução ─────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════════════');
console.log(' SIMULAÇÃO · ELENCO INTEIRO · 22 jogadores · 38 rodadas · motor atual');
console.log(` BASE_XP=${BASE_TRAINING_XP} · XP/attr=${XP_PER_ATTR_POINT}`);
console.log(' Titulares 11 · Rotação 5 · Reservas 6 · pulsos 4× + fim de temporada');
console.log('══════════════════════════════════════════════════════════════════\n');

const squadA = mkSquad(2026, 'B', 68);
const squadB = mkSquad(3030, 'A', 78);

const squadRuns = [
  {
    label: 'Série B (OVR ~68) · Desenvolvimento todos os dias livres',
    roster: JSON.parse(JSON.stringify(squadA)),
    freeMode: 'development',
    focus: 'individual',
    rngSeed: 1001,
  },
  {
    label: 'Série B · Gestão de Carga nos dias livres (só descanso)',
    roster: JSON.parse(JSON.stringify(squadA)),
    freeMode: 'load',
    rngSeed: 1001,
  },
  {
    label: 'Série B · Treina se energia≥50% (descanso inteligente)',
    roster: JSON.parse(JSON.stringify(squadA)),
    freeMode: 'development',
    smartRest: true,
    rngSeed: 1001,
  },
  {
    label: 'Série B · Híbrido: titulares descansam, reservas/rotação treinam',
    roster: JSON.parse(JSON.stringify(squadA)),
    freeMode: 'development',
    hybridByProfile: true,
    rngSeed: 1001,
  },
  {
    label: 'Série A (OVR ~78) · Desenvolvimento todos os dias livres',
    roster: JSON.parse(JSON.stringify(squadB)),
    freeMode: 'development',
    focus: 'individual',
    rngSeed: 2002,
  },
];

const squadResults = squadRuns.map(run => simulateSquadSeason({ squadLabel: run.label, ...run }));

squadResults.forEach(res => {
  console.log(`\n${'═'.repeat(66)}`);
  console.log(` ${res.squadLabel}`);
  console.log(`${'═'.repeat(66)}`);
  console.log(
    ` Plantel: ${res.rows.length} jog · ${res.playersUp} subiram OVR · ΣΔ=${res.squadTotalOvr} (treino +${res.squadTrainOvr}, jogos +${res.squadPulseOvr})`,
  );
  console.log(` Dias livres: ${res.squadFreeDev} treino · ${res.squadFreeRest} descanso\n`);
  printPlayerTable(res.rows);

  console.log('\n  Por perfil de minutos:');
  Object.entries(res.byProfile).forEach(([prof, v]) => {
    console.log(
      `    ${prof.padEnd(8)} n=${v.count} · méd ΔOVR +${v.avgDelta} · Σ treino +${v.train} · Σ jogos +${v.pulse}`,
    );
  });
  printBandSummary(res.byBand);
});

// ─── Comparativo entre modos (Série B) ─────────────────────────────────────

console.log(`\n\n${'═'.repeat(66)}`);
console.log(' COMPARATIVO · Série B · qual modo nos dias livres?');
console.log(`${'═'.repeat(66)}\n`);
console.log('Modo'.padEnd(42) + 'ΣΔOVR'.padStart(7) + 'Treino'.padStart(8) + 'Jogos'.padStart(8) + 'Subiram'.padStart(9));
console.log('─'.repeat(72));
squadResults.slice(0, 4).forEach(r => {
  console.log(
    r.squadLabel.slice(0, 41).padEnd(42) +
      String(r.squadTotalOvr).padStart(7) +
      String(r.squadTrainOvr).padStart(8) +
      String(r.squadPulseOvr).padStart(8) +
      `${r.playersUp}/${r.rows.length}`.padStart(9),
  );
});

// ─── Variações de foco (1 jogador isolado p/ referência) ───────────────────

console.log(`\n\n${'═'.repeat(66)}`);
console.log(' VARIAÇÃO DE FOCO · U20 reserva isolada · Desenvolvimento · 150 dias');
console.log(`${'═'.repeat(66)}\n`);

const focusIds = ['finishing', 'passing', 'defense', 'dribble', 'individual'];
for (const focus of focusIds) {
  const p = generatePlayer({ role: 'ATA', index: 1, clubPower: 64, division: 'B', random: () => 0.42, starterBoost: false });
  p.age = 20;
  p.potential = 78;
  p.fatigue = 85;
  ensurePlayerId(p, { seed: 99, club: 'sim', index: 0 });
  p._profile = 'reserva';
  p._minsPerGame = 0;
  p._gamesRate = 0;
  p._rating = 6.5;
  p.fatigue = 85;

  const res = simulateSquadSeason({
    squadLabel: focus,
    roster: [p],
    freeMode: 'development',
    focus,
    rounds: 38,
  });
  const r = res.rows[0];
  console.log(
    `  ${focus.padEnd(12)} OVR ${r.startOvr}→${r.endOvr} (+${r.totalDelta}) · treino +${r.trainOvr} · attrs +${r.attrs}`,
  );
}

console.log(`\n${'─'.repeat(66)}`);
console.log(' CONTEXTO GERAL');
console.log(`${'─'.repeat(66)}`);
const main = squadResults[0];
console.log(`• Elenco Série B com Desenvolvimento: +${main.squadTotalOvr} OVR somados no plantel (${main.playersUp}/22 jogadores).`);
console.log(`  └ treino: +${main.squadTrainOvr} · participação (pulsos): +${main.squadPulseOvr}`);
console.log('• Reservas U22 ganham quase só por TREINO; titulares quase só por JOGOS.');
console.log('• Gestão de Carga zera treino — evolução fica só nos titulares/rotación via pulsos.');
console.log('• Modo híbrido (titular descansa, banco treina): equilibra fadiga e concentra treino no banco.');
console.log('• Teto treino U22: +2 OVR/jogador · U23–26: +1 · 33+: +0 (mesmo treinando todo dia).');
console.log('• Pulsos: até ~+3 OVR/jogador jovem titular com boa nota e minutos na temporada.\n');
