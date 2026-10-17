/**
 * O histórico do jogador sobrevive à renomeação?
 *
 * Preocupação real: gol, jogos e nota ficam num store por chave. Se a chave
 * derivar do nome, renomear o jogador abre uma ficha nova e o histórico some —
 * sem erro, só um jogador que "recomeçou".
 *
 * Este teste usa a API real (buildMatchPlayerSheets + createPlayerHistoryEngine),
 * não uma simulação.
 *
 * node scripts/player-history-rename-tests.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMatchPlayerSheets, playerKey } from '../js/engine/player-match-stats.js';
import { createPlayerHistoryEngine, resolvePlayerSeasonStats, playerSeasonLeaderboard } from '../js/engine/player-history.js';
import { ensurePlayerId } from '../js/engine/player-identity.js';
import { renamePlayerInRoster } from '../js/engine/player-names.js';

// localStorage em memória, mesmo padrão dos outros testes do projeto.
const memory = new Map();
globalThis.localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: key => { memory.delete(key); },
  key: index => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
  clear() { memory.clear(); },
};
const backup = fs.readFileSync;
globalThis.readJson = null;
void backup;

let passed = 0;
let failed = 0;
function check(nome, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${nome}`);
  } catch (erro) {
    failed += 1;
    console.log(`✗ ${nome}`);
    console.log(`    ${erro.message}`);
  }
}

const ATRIBUTOS = {
  dribble: 60, speed: 60, marking: 60, tackling: 60, finishing: 60, passing: 60,
  heading: 60, positioning: 60, penaltySaving: 0, reflexes: 0, freeKick: 50,
  penaltyTaking: 50, playmaking: 60, fatigue: 100, injuryHistory: [],
  workload: { minutesLast7Days: 0, minutesLast14Days: 0, matchesLast14Days: 0, consecutiveStarts: 0, highIntensityLoad: 0, lastMatchRound: 0 },
};

function makeRoster(nomes, clube) {
  return nomes.map((nome, index) =>
    ensurePlayerId(
      { name: nome, pos: index === 0 ? 'GOL' : index > 8 ? 'ATA' : 'MC', age: 24, overall: 70, height: 180, number: index + 1, ...ATRIBUTOS },
      { seed: 7, club: clube, index },
    ),
  );
}

const NOMES = ['Gol Home', 'Zag A', 'Zag B', 'Zag C', 'Mei Home', 'Mei B', 'Mei C', 'Mei D', 'Ata Home', 'Ata B', 'Ata C'];
const NOMES_AD = ['Gol Away', 'Zag X', 'Zag Y', 'Zag Z', 'Mei Away', 'Mei Y', 'Mei Z', 'Mei W', 'Ata Away', 'Ata Y', 'Ata Z'];

function montaClubs(home, away) {
  return {
    [home]: { name: home, roster: makeRoster(NOMES, home) },
    [away]: { name: away, roster: makeRoster(NOMES_AD, away) },
  };
}

function montaGame(home, away, { homeGoals = 2, homeScorer = 'Ata Home', round = 1 } = {}) {
  const rosterHome = NOMES;
  const rosterAway = NOMES_AD;
  return {
    home,
    away,
    round,
    homeGoals,
    awayGoals: 0,
    workload: {
      home: rosterHome.slice(0, 11).map((name, i) => ({ name, minutes: i < 11 ? 90 : 0, started: true })),
      away: rosterAway.slice(0, 11).map((name, i) => ({ name, minutes: i < 11 ? 90 : 0, started: true })),
    },
    discipline: { home: [], away: [] },
    goals: {
      home: Array.from({ length: homeGoals }, (_, i) => ({
        name: homeScorer, minute: 20 + i * 20, type: i === 0 ? 'goal' : 'goal',
      })),
      away: [],
    },
    data: { homePossession: 55, awayPossession: 45, homeShots: 12, awayShots: 8, homeXg: 2.0, awayXg: 0.8 },
    competition: 'LEAGUE',
    season: 2026,
  };
}

// O engine resolve o elenco por `getClub`; sem isso a ficha cai no fallback
// `{name, age:0}` e a chave vira slug — que é exatamente o bug que o teste
// precisa distinguir da falta de id.
let CLUBES_ATUAIS = {};
const history = createPlayerHistoryEngine({
  getStorage: () => globalThis.localStorage,
  now: () => Date.now(),
  getClub: nome => CLUBES_ATUAIS[nome] || null,
});

check('playerKey usa playerId quando existe', () => {
  const p = ensurePlayerId({ name: 'Ata Home', age: 24 }, { seed: 7, club: 'Alpha', index: 8 });
  assert.equal(playerKey(p), String(p.playerId));
  assert.ok(!playerKey(p).includes('ata-home'), 'nao pode cair no slug de nome');
});

check('a ficha da partida usa o playerId como chave', () => {
  const clubs = montaClubs('Alpha', 'Beta');
  const built = buildMatchPlayerSheets(montaGame('Alpha', 'Beta'), { getClub: n => clubs[n] });
  const ata = built.home.find(r => r.name === 'Ata Home');
  assert.ok(ata, 'ficha do atacante nao encontrada');
  const alvo = clubs.Alpha.roster.find(p => p.name === 'Ata Home');
  assert.equal(ata.key, alvo.playerId, 'sheet.key deveria ser o playerId');
});

check('historico acumula no MESMO jogador apos renomear', () => {
  memory.clear();
  const clubs = montaClubs('Alpha', 'Beta');
  CLUBES_ATUAIS = clubs;
  const alvo = clubs.Alpha.roster.find(p => p.name === 'Ata Home');
  const idOriginal = alvo.playerId;
  const Temporada = 2026;

  // Jogo 1, antes de renomear.
  const g1 = montaGame('Alpha', 'Beta', { homeGoals: 2, homeScorer: 'Ata Home', round: 1 });
  history.recordMatch(g1, { season: Temporada, competition: 'LEAGUE', round: 1 });

  // Renomeia no meio da temporada.
  const r = renamePlayerInRoster(clubs.Alpha.roster, idOriginal, 'Zé da Silva', { currentSeason: Temporada });
  assert.ok(r.ok, `renomeacao falhou: ${r.error}`);

  // Jogo 2, depois de renomear. O workload vem do elenco ATUAL — é assim que o
  // motor monta a escala real de uma partida.
  const g2 = {
    ...montaGame('Alpha', 'Beta', { homeGoals: 1, homeScorer: 'Zé da Silva', round: 2 }),
    workload: {
      home: clubs.Alpha.roster.map(p => ({ name: p.name, minutes: 90, started: true })),
      away: clubs.Beta.roster.map(p => ({ name: p.name, minutes: 90, started: true })),
    },
  };
  history.recordMatch(g2, { season: Temporada, competition: 'LEAGUE', round: 2 });

  const stats = resolvePlayerSeasonStats(history, idOriginal, Temporada, null, { clubId: null });
  assert.ok(stats, `sem estatisticas para ${idOriginal}`);
  const jogos = Number(stats.apps) || 0;
  const gols = Number(stats.goals) || 0;
  assert.equal(jogos, 2, `esperava 2 jogos no mesmo jogador, veio ${jogos}`);
  assert.equal(gols, 3, `esperava 3 gols acumulados (2+1), veio ${gols}`);

  // E o nome exibido tem de ser o novo, sem abrir uma ficha separada.
  const store = history.getStore();
  const ficha = store.players[idOriginal];
  assert.equal(ficha.name, 'Zé da Silva', 'o historico deveria exibir o nome novo');
  const chaves = Object.keys(store.players);
  assert.equal(chaves.length, 22, `22 jogadores no jogo, mas o store tem ${chaves.length} fichas`);
  const slugs = chaves.filter(k => !k.startsWith('p-'));
  assert.equal(
    slugs.length,
    0,
    `nenhuma ficha pode ficar presa ao slug do nome antigo: ${slugs.join(', ')}`,
  );
});

check('o leaderboard da temporada segue o mesmo jogador', () => {
  memory.clear();
  const clubs = montaClubs('Alpha', 'Beta');
  CLUBES_ATUAIS = clubs;
  const alvo = clubs.Alpha.roster.find(p => p.name === 'Ata Home');
  const id = alvo.playerId;
  history.recordMatch(
    montaGame('Alpha', 'Beta', { homeGoals: 3, homeScorer: 'Ata Home', round: 1 }),
    { season: 2026, competition: 'LEAGUE', round: 1 },
  );
  renamePlayerInRoster(clubs.Alpha.roster, id, 'Zé da Silva', { currentSeason: 2026 });

  const tabuleiro = playerSeasonLeaderboard(history, { season: 2026, metric: 'goals' });
  const linha = tabuleiro.find(r => r.key === id);
  assert.ok(linha, `o artilheiro nao apareceu no leaderboard (linhas: ${tabuleiro.length})`);
  assert.equal(Number(linha.goals), 3, `esperava 3 gols no leaderboard, veio ${linha.goals}`);
  assert.equal(linha.name, 'Zé da Silva', 'o leaderboard deve exibir o nome atual');
});

console.log(`\nplayer-history-rename: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);