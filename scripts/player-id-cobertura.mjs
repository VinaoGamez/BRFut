/**
 * Cobertura de `playerId` pelo caminho REAL de criação de carreira.
 *
 * Lição: a primeira versão mediu `generateSquad`, que só os scripts de teste
 * chamam, e concluiu 0%. O jogo de verdade passa por
 * `career-clubs-bootstrap` -> `stampWorldPlayers`. Medir o caminho errado dá
 * diagnóstico errado.
 *
 * node scripts/player-id-cobertura.mjs
 */
import { generatePlayer, buildSquadRoles, pickStarterFlags, rollProfessionalSquadSize } from '../js/engine/player-generation.js';
import { stampWorldPlayers } from '../js/engine/world-rosters.js';

let seed = 424242;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const DIVISIONS = ['A', 'B', 'C', 'D'];
const CLUBES_POR_DIVISAO = 40;

function gerarElenco(division, clubIndex) {
  const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
  const starters = pickStarterFlags(roles.length, rng);
  return roles.map((role, i) =>
    generatePlayer({
      role,
      index: i + clubIndex * 29,
      clubPower: 55 + (clubIndex % 25),
      division,
      random: rng,
      starterBoost: starters[i],
    }),
  );
}

// --- monta o mundo como o bootstrap faz ---
const clubs = {};
let idx = 0;
for (const division of DIVISIONS) {
  for (let c = 0; c < CLUBES_POR_DIVISAO; c += 1) {
    const nome = `${division}-${c}`;
    clubs[nome] = { name: nome, division, roster: gerarElenco(division, idx) };
    idx += 1;
  }
}

const antesDe = [];
for (const club of Object.values(clubs)) {
  for (const p of club.roster) antesDe.push(Boolean(p.playerId));
}
const semIdAntes = antesDe.filter(v => !v).length;

stampWorldPlayers(clubs, { seed: 20260717, season: 2026 });

// --- depois ---
const semId = [];
const ids = new Map();
const colisoes = [];
let total = 0;
for (const [nomeClube, club] of Object.entries(clubs)) {
  for (const p of club.roster) {
    total += 1;
    if (!p.playerId) { semId.push(`${nomeClube}/${p.name}`); continue; }
    if (ids.has(p.playerId)) colisoes.push(`${p.playerId} em ${ids.get(p.playerId)} e ${nomeClube}`);
    ids.set(p.playerId, nomeClube);
  }
}

console.log(`${total} jogadores em ${Object.keys(clubs).length} clubes`);
console.log('');
console.log(`sem playerId ANTES do stamp: ${semIdAntes} (${((semIdAntes / total) * 100).toFixed(1)}%)`);
console.log(`sem playerId DEPOIS do stamp: ${semId.length} (${((semId.length / total) * 100).toFixed(1)}%)`);
console.log(`ids unicos no mundo: ${ids.size}`);
console.log(`colisoes de id: ${colisoes.length}`);
for (const c of colisoes.slice(0, 5)) console.log(`  ${c}`);

// --- o teste que importa: o id sobrevive a uma mudanca de clube? ---
console.log('');
console.log('--- o id sobrevive a transferencia? ---');
const amostra = clubs['A-0'].roster.slice(0, 3);
const idsOriginais = amostra.map(p => p.playerId);
amostra.forEach(p => { p.club = 'B-0'; });
stampWorldPlayers(clubs, { seed: 20260717, season: 2026 });
const idsDepois = amostra.map(p => p.playerId);
const estaveis = idsOriginais.every((id, i) => id === idsDepois[i]);
console.log(`  ${estaveis ? 'SIM' : 'NAO'} - ensurePlayerId nao regenera id existente`);
for (let i = 0; i < amostra.length; i += 1) {
  console.log(`  ${amostra[i].name}: ${idsOriginais[i]} -> ${idsDepois[i]}`);
}