/**
 * Demanda real de nomes por nacionalidade.
 *
 * Dimensiona os pools do arquivo de dados: quantos jogadores de cada
 * nacionalidade o jogo realmente cria, e quantos nomes distintos essa
 * nacionalidade precisa ter para não repetir dentro de um elenco.
 *
 * node scripts/nome-demanda.mjs
 */
import { generatePlayer, buildSquadRoles, pickStarterFlags, rollProfessionalSquadSize } from '../js/engine/player-generation.js';
import { assignRosterNationalities, FOREIGN_NATIONS } from '../js/engine/player-nationality.js';
import { PLAYER_NAME_POOLS, PLAYER_NAME_REGIONS } from '../js/engine/player-names.js';

let seed = 31337;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// O mundo: A tem 191 clubes (várias ligas), B/C/D só Brasil.
const DIVISOES = [
  { chave: 'A', clubes: 191 },
  { chave: 'B', clubes: 24 },
  { chave: 'C', clubes: 20 },
  { chave: 'D', clubes: 96 },
];

const porNacao = new Map();
let total = 0;
let porDivisao = { A: 0, B: 0, C: 0, D: 0 };

for (const { chave, clubes } of DIVISOES) {
  for (let c = 0; c < clubes; c += 1) {
    const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
    const starters = pickStarterFlags(roles.length, rng);
    const roster = roles.map((role, i) =>
      generatePlayer({ role, index: i, clubPower: 55 + (c % 25), division: chave, random: rng, starterBoost: starters[i] }),
    );
    assignRosterNationalities(roster, chave, rng);
    for (const p of roster) {
      total += 1;
      porDivisao[chave] += 1;
      const n = p.nationality || 'Brasil';
      porNacao.set(n, (porNacao.get(n) || 0) + 1);
    }
  }
}

console.log(`mundo gerado: ${total} jogadores em ${DIVISOES.reduce((s, d) => s + d.clubes, 0)} clubes`);
console.log(`por divisao: A=${porDivisao.A} B=${porDivisao.B} C=${porDivisao.C} D=${porDivisao.D}`);
console.log('');

console.log('demanda por nacionalidade');
console.log('─'.repeat(74));
console.log('nacionalidade'.padEnd(18) + 'pool usada'.padEnd(18) + 'jogadores'.padStart(9) + 'pool'.padStart(12) + 'combinacoes'.padStart(12) + 'cobertura'.padStart(11));
console.log('─'.repeat(74));

const ordenadas = [...porNacao].sort((a, b) => b[1] - a[1]);
for (const [nacao, qtd] of ordenadas) {
  // Mesmo fallback do jogo: pool do pais, depois da regiao.
  const pool = PLAYER_NAME_POOLS[nacao] || PLAYER_NAME_POOLS[PLAYER_NAME_REGIONS[nacao]];
  const origem = pool ? (PLAYER_NAME_POOLS[nacao] ? nacao : PLAYER_NAME_REGIONS[nacao]) : '-';
  const comb = pool ? pool.first.length * pool.last.length : 0;
  const cobertura = comb ? `${Math.round((qtd / comb) * 100)}x` : 'sem pool';
  console.log(nacao.padEnd(20) + String(qtd).padStart(11) + (pool ? `${pool.first.length}x${pool.last.length}` : '-').padStart(14) + String(comb).padStart(14) + cobertura.padStart(12));
}

console.log('─'.repeat(74));
console.log('');

// Pools declarados que nunca sao alcancados por assignRosterNationalities.
const usadas = new Set(ordenadas.map(([n]) => n));
const orfas = Object.keys(PLAYER_NAME_POOLS).filter(k => !usadas.has(k));
console.log(`pools declarados: ${Object.keys(PLAYER_NAME_POOLS).length}`);
console.log(`pools usados por assignRosterNationalities: ${usadas.size} (${[...usadas].join(', ')})`);
console.log(`pools NUNCA usados no fluxo de elencos: ${orfas.length}`);
console.log(`  ${orfas.join(', ')}`);
console.log('');
console.log('FOREIGN_NATIONS disponiveis para estrangeiros:', FOREIGN_NATIONS.length, '->', FOREIGN_NATIONS.join(', '));
console.log('');
console.log('--- o que o dimensionamento pede ---');
for (const [nacao, qtd] of ordenadas.slice(0, 8)) {
  // Alvo: cada nacionalidade tem nomes suficientes para 25x a demanda
  // global sem repetir dentro de um elenco de 25.
  const alvo = Math.ceil(Math.sqrt(qtd * 25));
  console.log(`  ${nacao.padEnd(12)} ${String(qtd).padStart(6)} jogadores  ->  pool alvo ~${alvo}x${alvo}  (comb ${(alvo * alvo).toLocaleString('pt-BR')})`);
}