/**
 * Mede o pool de nomes e a taxa de colisão real por nacionalidade.
 *
 * Pergunta que responde: os homônimos que o motor tem que resolver na marra
 * são raros (o pool dá conta) ou são a norma (o dedupe vira o caminho comum)?
 *
 * node scripts/nome-colisao.mjs
 */
import { PLAYER_NAME_POOLS, rollPlayerName } from '../js/engine/player-names.js';

const fmt = n => n.toLocaleString('pt-BR');

console.log('pool por nacionalidade');
console.log('─'.repeat(62));
console.log(
  'nacionalidade'.padEnd(18) + 'primeiros'.padStart(10) + 'sobrenomes'.padStart(12) +
  'combinacoes'.padStart(14) + 'sorteios p/ 1000'.padStart(18),
);
console.log('─'.repeat(62));

let totalCombinacoes = 0;
const linhas = [];

for (const [nacionalidade, pool] of Object.entries(PLAYER_NAME_POOLS)) {
  const f = pool.first.length;
  const l = pool.last.length;
  // `rollPlayerName` ainda acrescenta um segundo sobrenome com 12% de chance no
  // Brasil, o que amplia o espaço efetivo.
  const comMeio = nacionalidade === 'Brasil' ? l + Math.round(l * 0.12) : l;
  const combinacoes = f * comMeio;
  totalCombinacoes += combinacoes;

  // Probabilidade de colisão em 1000 sorteios sem reposição mental:
  // birthday paradoxo aproximado sobre o espaço de nomes.
  const n = 1000;
  const pColisao = 1 - Math.exp((-n * (n - 1)) / (2 * combinacoes));
  linhas.push({ nacionalidade, f, l, combinacoes, pColisao });
  console.log(
    nacionalidade.padEnd(18) +
    String(f).padStart(10) +
    String(l).padStart(12) +
    fmt(combinacoes).padStart(14) +
    `${(pColisao * 100).toFixed(1)}%`.padStart(18),
  );
}

console.log('─'.repeat(62));
console.log(`soma das combinações de todos os pools: ${fmt(totalCombinacoes)}`);
console.log('');

// O mundo tem 1018 clubes. Um elenco de futebol tem ~25 jogadores.
const CLUBES = 1018;
const POR_ELENCO = 25;
const ELENCOS = CLUBES * POR_ELENCO;
console.log(`elenco gerado no mundo (${CLUBES} clubes x ${POR_ELENCO}) = ${fmt(ELENCOS)} jogadores`);
console.log('');

const br = linhas.find(l => l.nacionalidade === 'Brasil');
console.log('Brasil — o caso que importa, porque quase tudo é brasileiro:');
console.log(`  espaço de nomes: ${fmt(br.combinacoes)}`);
console.log(`  por um elenco de ${POR_ELENCO}: colisão garantida`);
console.log(`  por todo o mundo: ${fmt(ELENCOS)} jogadores disputando ${fmt(br.combinacoes)} nomes`);
console.log(`  => cada nome precisa ser usado ~${(ELENCOS / br.combinacoes).toFixed(0)}x`);

// Medição direta no gerador, com a seed fixa que o motor usa.
let seed = 12345;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const sorteados = [];
const N = 50000;
for (let i = 0; i < N; i += 1) sorteados.push(rollPlayerName({ nationality: 'Brasil', index: i, random }));

const distintos = new Set(sorteados);
const freq = new Map();
for (const n of sorteados) freq.set(n, (freq.get(n) || 0) + 1);

console.log('');
console.log(`sorteio direto do gerador (${fmt(N)} chamadas, seed fixa)`);
console.log(`  nomes distintos: ${fmt(distintos.size)}`);
console.log(`  collide de verdade (${fmt(distintos.size)} < ${fmt(N)}): ${distintos.size < N ? 'SIM' : 'NAO'}`);
console.log('');

// Top 10 mais repetidos: e' o que o jogador ve no jogo.
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('nomes que mais se repetem (o que aparece na tela):');
for (const [nome, vezes] of top) {
  console.log(`  ${String(vezes).padStart(5)}x  ${nome}`);
}

// Cobertura de surnames: quantos dos 47 sobrinhos aparecem de fato?
const sobrenomesUsados = new Set(sorteados.map(n => n.split(' ').at(-1)).filter(Boolean));
const totalSobrenomes = PLAYER_NAME_POOLS.Brasil.last.length;
console.log('');
console.log(`cobertura de sobrenome: ${sobrenomesUsados.size}/${totalSobrenomes} usados`);