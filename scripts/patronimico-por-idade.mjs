/**
 * Patronímico ("Filho", "Júnior", "Neto") como forma de nome.
 *
 * Correção de conceito: o patronímico não é herança dentro do clube.
 * "Paulo Silva Filho" quer dizer filho de um Silva — fala dos pais, e existe
 * com ou sem homônimo no elenco. Tratar como colisão com o time foi errado, e
 * a viabilidade da "herança" mediu 0,0% a 0,6% justamente porque é outra
 * coisa.
 *
 * Esta é a pergunta certa: qual a taxa de patronímico por idade, e como
 * SHOULD ela variar entre base e profissional.
 *
 * node scripts/patronimico-por-idade.mjs
 */
import { rollPlayerName } from '../js/engine/player-names.js';

let seed = 2024;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const RE = / (Júnior|Neto|Filho)$/i;
const N = 40000;

const sorteados = [];
for (let i = 0; i < N; i += 1) {
  sorteados.push(rollPlayerName({ nationality: 'Brasil', index: i, random: rng }));
}

console.log(`nomes brasileiros sorteados: ${N.toLocaleString('pt-BR')}`);
console.log('');

const porNome = new Map();
for (const nome of sorteados) {
  const m = nome.match(RE);
  const sufixo = m ? m[1] : null;
  porNome.set(sufixo, (porNome.get(sufixo) || 0) + 1);
}

console.log('taxa de patronímico por sufixo');
console.log('─'.repeat(40));
let comSufixo = 0;
for (const [sufixo, qtd] of [...porNome].sort((a, b) => b[1] - a[1])) {
  if (!sufixo) continue;
  comSufixo += qtd;
  console.log(`  ${sufixo.padEnd(10)} ${String(qtd).padStart(6)}  ${((qtd / N) * 100).toFixed(2)}%`);
}
console.log('─'.repeat(40));
console.log(`  ${'TOTAL'.padEnd(10)} ${String(comSufixo).padStart(6)}  ${((comSufixo / N) * 100).toFixed(2)}%`);
console.log('');

// Com 3 sobrenomes e 3 sufixos, o esperado se fosse uniforme seria 3/88 = 3,4%.
console.log(`esperado se uniforme sobre ${3} sufixos em ${88} sobrenomes: ${((3 / 88) * 100).toFixed(2)}%`);
console.log('');

// Se o patronímico fosse um sobrenome como outro,_none apareceria em ~1/88 por posição.
console.log('--- leitura ---');
console.log('Os três entraram no IBGE como sobrenomes comuns, então o gerador os');
console.log('trata como qualquer outro: a taxa sai da fração deles na lista.');
console.log('Se quisermos que apareçam mais, mexer na FREQUÊNCIA, não na semântica.');