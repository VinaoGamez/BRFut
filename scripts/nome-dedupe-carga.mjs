/**
 * Quanto o dedupe de nomes trabalha na prática, e o que ele produz.
 *
 * O pool brasileiro tem 2.700 combinações para 25.450 jogadores no mundo.
 * A pergunta é: quanto do mundo entra pelo caminho comum e quanto pelo
 * caminho de emergência (variante com sufixo/sobrenome extra)?
 *
 * node scripts/nome-dedupe-carga.mjs
 */
import { rollPlayerName, dedupeRosterNames } from '../js/engine/player-names.js';

let seed = 987654321;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const CLUBES = 1018;
const POR_ELENCO = 25;
const CLUBES_BRASILEIROS = 200;

const PATRONIMICOS = ['Júnior', 'Neto', 'Filho'];

let collided = 0;
let total = 0;
let comSobrenomeExtra = 0;
let comPatronimico = 0;
let comInicial = 0;
const freq = new Map();
const sobreviventes = [];

for (let c = 0; c < CLUBES_BRASILEIROS; c += 1) {
  const roster = [];
  for (let i = 0; i < POR_ELENCO; i += 1) {
    roster.push({ name: rollPlayerName({ nationality: 'Brasil', index: i + c * 7, random }) });
  }
  // Mede antes do dedupe.
  const antes = new Map();
  for (const p of roster) antes.set(p.name, (antes.get(p.name) || 0) + 1);
  collided += [...antes.values()].reduce((soma, n) => soma + n - 1, 0);

  dedupeRosterNames(roster, { random });

  const vistos = new Set();
  for (const p of roster) {
    total += 1;
    if (vistos.has(p.name)) sobreviventes.push(`ELENCO ${c}: "${p.name}" duplicado apos dedupe`);
    vistos.add(p.name);
    freq.set(p.name, (freq.get(p.name) || 0) + 1);

    const partes = p.name.split(' ');
    if (partes.length >= 3) comSobrenomeExtra += 1;
    if (partes.length >= 2 && PATRONIMICOS.includes(partes.at(-1))) comPatronimico += 1;
    if (/^\w\.\s/.test(p.name)) comInicial += 1;
  }
}

const pct = (n, d) => ((n / d) * 100).toFixed(1);

console.log(`${CLUBES_BRASILEIROS} elencos brasileiros x ${POR_ELENCO} jogadores = ${total} jogadores`);
console.log('');
console.log('carga do dedupe');
console.log(`  colisoes antes do dedupe: ${collided} (${pct(collided, total)}% dos jogadores)`);
console.log(`  duplicados sobrevivendo:   ${sobreviventes.length}`);
console.log('');
console.log('como o dedupe resolveu (percentual dos jogadores)');
console.log(`  sobrenome extra (3 partes): ${pct(comSobrenomeExtra, total)}%`);
console.log(`  patronimico (Junior/Neto/Filho): ${pct(comPatronimico, total)}%`);
console.log(`  inicial ("A. Silva"): ${pct(comInicial, total)}%`);
console.log('');
console.log(`nomes distintos gerados: ${freq.size} (pool de 2.700 combinacoes)`);

const maisComum = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('');
console.log('nomes mais repetidos entre os elencos ja deduplicados:');
for (const [nome, vezes] of maisComum) console.log(`  ${String(vezes).padStart(4)}x  ${nome}`);

// Compara com o que o jogo realmente mostra: um unico clube.
console.log('');
console.log('--- o que aparece na tela de um clube so ---');
const amostra = [];
for (let i = 0; i < POR_ELENCO; i += 1) {
  amostra.push({ name: rollPlayerName({ nationality: 'Brasil', index: i, random }) });
}
const colisoesNoElenco = new Map();
for (const p of amostra) {
  colisoesNoElenco.set(p.name, (colisoesNoElenco.get(p.name) || 0) + 1);
}
dedupeRosterNames(amostra, { random });
for (const p of amostra) {
  const repetido = (colisoesNoElenco.get(p.name) || 0) > 1 ? '  <- colidia, dedupeu' : '';
  console.log(`  ${p.name}${repetido}`);
}