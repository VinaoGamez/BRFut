/**
 * Viabilidade da herança de nome na base.
 *
 * "Júnior" significa filho com o mesmo nome do pai. Para o sufixo fazer
 * sentido não pode ser aleatório: tem que existir um homônimo no clube. Este
 * script mede com que frequência o nome sorteado para um jogador de base já
 * colide com alguém do elenco — é isso que define a taxa de disparo.
 *
 * node scripts/sufixo-base-viabilidade.mjs
 */
import { generatePlayer, buildSquadRoles, pickStarterFlags, rollProfessionalSquadSize } from '../js/engine/player-generation.js';
import { rollPlayerName } from '../js/engine/player-names.js';

let seed = 777;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const normalizar = n => n.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

const DIVISOES = ['A', 'B', 'C', 'D'];
console.log('colisão do nome sorteado para a base');
console.log('─'.repeat(66));
console.log('divisão'.padEnd(11) + 'elite'.padStart(9) + 'colide'.padStart(10) + 'taxa'.padStart(9));
console.log('─'.repeat(66));

for (const divisao of DIVISOES) {
  const CLUBES = 60;
  let base = 0;
  let colide = 0;
  for (let c = 0; c < CLUBES; c += 1) {
    const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
    const starters = pickStarterFlags(roles.length, rng);
    const elenco = roles.map((role, i) =>
      generatePlayer({ role, index: i, clubPower: 55 + (c % 20), division: divisao, random: rng, starterBoost: starters[i] }),
    );
    const existentes = new Set(elenco.map(p => normalizar(p.name)));

    // 6 jogadoress de base por avaliação, como o clube teria.
    for (let j = 0; j < 6; j += 1) {
      const nome = rollPlayerName({ nationality: 'Brasil', index: Math.floor(rng() * 1000), random: rng });
      base += 1;
      const semSufixo = nome.replace(/ (Júnior|Neto|Filho)$/i, '');
      if (existentes.has(normalizar(semSufixo))) colide += 1;
    }
  }
  console.log(
    divisao.padEnd(11) + String(CLUBES * 6).padStart(9) + String(colide).padStart(10) +
    ((colide / base) * 100).toFixed(1).padStart(8) + '%',
  );
}

console.log('─'.repeat(66));
console.log('');
console.log('Leitura: se a taxa for baixa, a herança sozinha quase nunca dispara.');
console.log('Aí o sufixo precisaria vir de um segundo caminho — ver a sugestão.');
console.log('');

// E com as duas familias de nome somadas (elenco + base já existente)?
console.log('--- considering base anterior do mesmo clube ---');
let total = 0;
let colide2 = 0;
for (let c = 0; c < 60; c += 1) {
  const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
  const starters = pickStarterFlags(roles.length, rng);
  const elenco = roles.map((role, i) =>
    generatePlayer({ role, index: i, clubPower: 55 + (c % 20), division: 'A', random: rng, starterBoost: starters[i] }),
  );
  const conhecidos = new Set(elenco.map(p => normalizar(p.name)));
  // O clube já tem uma geração de base: 12 atletas.
  for (let j = 0; j < 12; j += 1) {
    conhecidos.add(normalizar(rollPlayerName({ nationality: 'Brasil', index: Math.floor(rng() * 1000), random: rng })));
  }
  for (let j = 0; j < 6; j += 1) {
    const nome = rollPlayerName({ nationality: 'Brasil', index: Math.floor(rng() * 1000), random: rng });
    total += 1;
    const semSufixo = nome.replace(/ (Júnior|Neto|Filho)$/i, '');
    if (conhecidos.has(normalizar(semSufixo))) colide2 += 1;
  }
}
console.log(`colide com elenco + base anterior: ${colide2}/${total} = ${((colide2 / total) * 100).toFixed(1)}%`);