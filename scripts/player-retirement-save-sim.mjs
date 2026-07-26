/**
 * Simulação de aposentadoria com save real (BR Fut / localStorage export).
 * Uso: node scripts/player-retirement-save-sim.mjs [caminho/matchday-new-game.json]
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  computeRetirementChance,
  processSeasonRetirements,
  shouldRetirePlayer,
} from '../js/engine/player-retirement.js';
import {
  computeLegacyRegenChance,
  eligibleLegacyPool,
  maybeRollLegacyYouthPlayer,
  LEGACY_REGEN_MAX_PER_SEASON,
} from '../js/engine/youth-legacy-regen.js';
import { playerKey } from '../js/engine/player-match-stats.js';
import { resolvePlayerId } from '../js/engine/player-identity.js';

const DEFAULT_SAVE = path.join(
  os.homedir(),
  'Documents',
  'BR Fut',
  'saves',
  'vinao',
  'matchday-new-game.json',
);

const saveArg = process.argv[2] || DEFAULT_SAVE;
const seasonArg = process.argv[3] || null;

function readEnvelope(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return raw?.value ?? raw;
}

function sibling(file) {
  return path.join(path.dirname(file), file);
}

function loadBundle(careerPath) {
  const career = readEnvelope(careerPath);
  if (!career) throw new Error(`Save não encontrado: ${careerPath}`);
  const dir = path.dirname(careerPath);
  const season = readEnvelope(path.join(dir, 'matchday-season.json'));
  const history = readEnvelope(path.join(dir, 'matchday-player-history.json'));
  return { career, season, history, dir };
}

function buildClubs(career) {
  const userClub = career.clubName;
  const clubs = {
    [userClub]: {
      roster: (career.userRoster || []).map(p => ({ ...p })),
      division: career.division || 'A',
    },
  };
  Object.entries(career.worldRosters || {}).forEach(([name, roster]) => {
    if (!Array.isArray(roster) || !roster.length) return;
    clubs[name] = {
      roster: roster.map(p => ({ ...p })),
      division: career.division || 'A',
    };
  });
  return { clubs, userClub };
}

function advanceAges(clubs) {
  Object.values(clubs).forEach(club => {
    club.roster.forEach(p => {
      p.age = (Number(p.age) || 0) + 1;
    });
  });
}

function getSeasonMinutesFactory(history, season) {
  const players = history?.players || {};
  return player => {
    const key = playerKey(player);
    const bucket = players[key]?.seasons?.[String(season)];
    const minutes = Number(bucket?.minutes);
    if (Number.isFinite(minutes)) return Math.max(0, minutes);
    return null;
  };
}

function minuteFallback(player) {
  const ovr = Number(player.overall) || 0;
  const starter = !!player.starter;
  if (starter && ovr >= 70) return 950;
  if (starter) return 720;
  if (ovr >= 72) return 600;
  if (ovr <= 20) return 90;
  return 240;
}

function resolveMinutes(player, getHistMinutes) {
  const fromHist = getHistMinutes?.(player);
  if (fromHist != null) return fromHist;
  return minuteFallback(player);
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function printVeterans(roster, ctx, label) {
  const vets = roster.filter(p => (Number(p.age) || 0) >= 36).sort((a, b) => b.age - a.age);
  console.log(`\n  ${label} (${vets.length} com 36+):`);
  if (!vets.length) {
    console.log('    (nenhum)');
    return vets;
  }
  vets.forEach(p => {
    const minutes = resolveMinutes(p, ctx.getSeasonMinutes);
    const chance = computeRetirementChance(p, { ...ctx, getSeasonMinutes: () => minutes });
    const check = shouldRetirePlayer(p, {
      ...ctx,
      getSeasonMinutes: () => minutes,
      clubName: ctx.userClub,
    });
    const rollTag = check.forced ? 'GARANTIDO' : check.retire ? `APOSENTA (roll ${(check.roll * 100).toFixed(1)}% < ${(check.chance * 100).toFixed(1)}%)` : `FICA (roll ${(check.roll * 100).toFixed(1)}%)`;
    console.log(
      `    • ${p.name} · ${p.age}a · ${p.pos} · OVR ${p.overall ?? '—'} · ${minutes} min · chance ${pct(chance)} → ${rollTag}`,
    );
  });
  return vets;
}

function simulateScouts(pool, userClub, season, searches = 30) {
  const hits = [];
  const club = { youthLegacyMeta: { season, count: 0 } };
  let seed = 0;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < searches; i += 1) {
    if ((club.youthLegacyMeta?.count || 0) >= LEGACY_REGEN_MAX_PER_SEASON) break;
    const result = maybeRollLegacyYouthPlayer({
      club,
      clubName: userClub,
      userClub,
      season,
      retiredPool: pool.map(e => ({ ...e, regenUsed: false })),
      legacyMeta: club.youthLegacyMeta,
      random,
      firstNames: ['Lucas', 'Gabriel', 'Pedro', 'Enzo'],
      lastNames: ['Silva', 'Santos', 'Oliveira'],
      division: 'D',
      uf: 'SP',
    });
    if (result?.player) {
      hits.push(result.player);
      club.youthLegacyMeta = { season, count: (club.youthLegacyMeta.count || 0) + 1 };
    }
  }
  return hits;
}

const { career, season, history, dir } = loadBundle(saveArg);
const { clubs, userClub } = buildClubs(career);
const currentSeason = Number(seasonArg || career.season || season?.playerDevelopment?.season || 2026);
const nextSeason = currentSeason + 1;
const round = season?.currentRound ?? '?';
const calendar = season?.careerCalendarDate ?? '—';

const getHistMinutes = getSeasonMinutesFactory(history, currentSeason);
const histPlayers = Object.keys(history?.players || {}).length;

console.log('\n══════════════════════════════════════════════════════════');
console.log('  SIMULAÇÃO · Save real · virada de temporada');
console.log('══════════════════════════════════════════════════════════');
console.log(`  Arquivo: ${saveArg}`);
console.log(`  Pasta:   ${dir}`);
console.log(`  Clube:   ${userClub}`);
console.log(`  Divisão: Série ${career.division || '?'}`);
console.log(`  Temporada atual: ${currentSeason} · rodada ${round} · calendário ${calendar}`);
console.log(`  Elenco: ${career.userRoster?.length ?? 0} · Mundo: ${Object.keys(career.worldRosters || {}).length} clubes`);
console.log(`  Histórico jogadores: ${histPlayers} entradas`);
console.log(`  Pool aposentados: ${(career.retiredPool || []).length}`);

const ctx = {
  season: currentSeason,
  userClub,
  getSeasonMinutes: player => resolveMinutes(player, getHistMinutes),
};

printVeterans(clubs[userClub].roster, ctx, 'Veteranos antes da virada (+1 idade)');

advanceAges(clubs);

const afterCtx = {
  season: currentSeason,
  userClub,
  getSeasonMinutes: player => resolveMinutes(player, getHistMinutes),
};

printVeterans(clubs[userClub].roster, afterCtx, 'Veteranos após +1 idade (check de aposentadoria)');

const result = processSeasonRetirements(clubs, {
  ...afterCtx,
  retiredPool: [...(career.retiredPool || [])],
});

console.log('\n── Resultado da virada ──');
console.log(`  Simulação: ${currentSeason} → ${nextSeason}`);
console.log(`  Mundial: ${result.retired.length} aposentados · ${result.deferred.length} adiados (piso 18)`);
console.log(
  `  ${userClub}: ${(career.userRoster || []).length} → ${clubs[userClub].roster.length} jogadores`,
);

if (result.userDepartures.length) {
  console.log(`\n  ★ Modal DESPEDIDAS (${result.userDepartures.length}):`);
  result.userDepartures.forEach(d => {
    console.log(`    • ${d.name} · ${d.retiredAge}a · ${d.pos} · OVR ${d.lastOverall}${d.forced ? ' · garantido' : ''}`);
  });
  const worldExtra = Math.max(0, result.retired.length - result.userDepartures.length);
  if (worldExtra) console.log(`    Rodapé: + ${worldExtra} aposentadorias no restante do campeonato.`);
} else {
  console.log('\n  Nenhuma despedida no seu clenco nesta virada (modal não abre).');
}

if (result.deferred.some(d => d.club === userClub)) {
  console.log('\n  Adiados no seu clube (piso 18):');
  result.deferred.filter(d => d.club === userClub).forEach(d => console.log(`    • ${d.name}`));
}

const userEligible = eligibleLegacyPool(result.pool, userClub, nextSeason);
console.log(`\n── Pool legado (${userClub}) ──`);
console.log(`  Total pool: ${result.pool.length} · elegíveis regen: ${userEligible.length}`);
userEligible.forEach(e => {
  console.log(
    `    • ${e.name} · ${e.retiredSeason} · OVR ${e.lastOverall}${e.star ? ' ★' : ''} · chance olheiro ${pct(computeLegacyRegenChance(e, { season: nextSeason }))}`,
  );
});

if (userEligible.length) {
  const hits = simulateScouts(result.pool, userClub, nextSeason, 30);
  console.log(`\n── Olheiros (30 buscas, 1ª virada pós-aposentadoria) ──`);
  if (hits.length) {
    hits.forEach(p => {
      console.log(`    ★ LEGADO: ${p.name} (${p.pos}) — filho/regen de ${p.legacyOf?.retiredName}`);
    });
  } else {
    console.log('    Nenhum regen nesta amostra (probabilístico — pode sair em outra busca).');
  }
}

const worldVets = Object.values(clubs).reduce((sum, club) => sum + club.roster.filter(p => (p.age || 0) >= 36).length, 0);
console.log(`\n── Panorama pós-virada ──`);
console.log(`  Veteranos 36+ restantes no mundo: ${worldVets}`);
console.log(`  Nota: minutos sem histórico usam heurística (titular/reserva/OVR).`);

console.log('\n══════════════════════════════════════════════════════════\n');
