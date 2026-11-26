/**
 * Distribuição real de estrangeiros por divisão no jogo.
 *
 * Pergunta: quantos estrangeiros cada clube brasileiro realmente recebe, por
 * divisão? Serve para conferir contra a realidade do Brasileirão — um clube de
 * Série D com 7 estrangeiros não existe.
 *
 * node scripts/estrangeiros-distribuicao.mjs
 */
import { generatePlayer, buildSquadRoles, pickStarterFlags, rollProfessionalSquadSize } from '../js/engine/player-generation.js';
import { assignRosterNationalities } from '../js/engine/player-nationality.js';

let seed = 8080;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const DIVISOES = [
  { chave: 'A', clubes: 20, rotulo: 'Série A' },
  { chave: 'B', clubes: 24, rotulo: 'Série B' },
  { chave: 'C', clubes: 20, rotulo: 'Série C' },
  { chave: 'D', clubes: 96, rotulo: 'Série D' },
  { chave: 'REG', clubes: 691, rotulo: 'Regional' },
];

console.log('estrangeiros por clube, por divisão');
console.log('─'.repeat(72));
console.log('divisão'.padEnd(11) + 'média'.padStart(8) + 'mín'.padStart(7) + 'máx'.padStart(7) + 'mediana'.padStart(10) + '  distribuição');
console.log('─'.repeat(72));

for (const { chave, clubes, rotulo } of DIVISOES) {
  const contagens = [];
  for (let c = 0; c < clubes; c += 1) {
    const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
    const starters = pickStarterFlags(roles.length, rng);
    const roster = roles.map((role, i) =>
      generatePlayer({ role, index: i, clubPower: 55 + (c % 25), division: chave, random: rng, starterBoost: starters[i] }),
    );
    assignRosterNationalities(roster, chave, rng);
    contagens.push(roster.filter(p => p.nationality && p.nationality !== 'Brasil').length);
  }
  contagens.sort((a, b) => a - b);
  const media = contagens.reduce((s, n) => s + n, 0) / contagens.length;
  const mediana = contagens[Math.floor(contagens.length / 2)];
  const hist = new Map();
  for (const n of contagens) hist.set(n, (hist.get(n) || 0) + 1);
  const barra = [...hist.entries()].sort((a, b) => a[0] - b[0])
    .map(([n, qtd]) => `${n}:${'█'.repeat(Math.max(1, Math.round(qtd / 3)))}`)
    .join(' ');
  console.log(
    rotulo.padEnd(11) + media.toFixed(1).padStart(8) + String(contagens[0]).padStart(7) +
    String(contagens[contagens.length - 1]).padStart(7) + String(mediana).padStart(10) + '  ' + barra,
  );
}

console.log('─'.repeat(72));
console.log('');
console.log('referência: teto legal da CBF é 9 na súmula em todas as divisões.');
console.log('O que a realidade entrega é bem abaixo do teto nas divisões menores.');