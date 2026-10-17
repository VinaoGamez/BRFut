/**
 * Sufixo patronímico como CAMADA, não como vaga de sobrenome.
 *
 * Uso: node scripts/sufixo-camada-tests.mjs
 *
 * O que trava aqui:
 *   - o sufixo é anexado ao nome herdado, uma vez só
 *   - "João Silva Júnior" e "João Júnior" são ambos válidos
 *   - "Júnior Júnior" e "Filho Filho" são impossíveis por construção
 *   - Filho/Júnior/Neto não ocupam mais vaga na lista de sobrenomes
 */
import assert from 'node:assert/strict';
import { PLAYER_NAME_POOLS, rollPlayerName } from '../js/engine/player-names.js';
import { readFileSync } from 'node:fs';

const SUFIXOS = ['Júnior', 'Neto', 'Filho'];
const chaveSemAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** PRNG fixo: o teste precisa falhar sempre igual. */
function rng(semente = 1) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('Filho, Júnior e Neto não são mais sobrenomes', () => {
  const br = PLAYER_NAME_POOLS.Brasil;
  for (const sufixo of SUFIXOS) {
    assert.ok(!br.last.includes(sufixo), `"${sufixo}" continua na lista de sobrenomes`);
  }
  // Se stayed lá, o sufixo viraria uma entrada entre 86 sobrenomes e o nome
  // do jogador diria "filho de alguém chamado Júnior".
  assert.deepEqual(br.sufixos, SUFIXOS);
});

teste('o sufixo aparece, e na taxa medida', () => {
  const N = 20000;
  let comSufixo = 0;
  for (let i = 0; i < N; i += 1) {
    const p = rollPlayerName({ nationality: 'Brasil', index: i, random: rng(31 + i) }).split(' ');
    if (p.some(x => SUFIXOS.includes(x))) comSufixo += 1;
  }
  const taxa = comSufixo / N;
  assert.ok(taxa > 0.03 && taxa < 0.07, `taxa de sufixo fora da faixa: ${taxa.toFixed(4)}`);
});

teste('nunca empilha: nem Júnior Júnior, nem Filho Filho', () => {
  for (let i = 0; i < 30000; i += 1) {
    const nome = rollPlayerName({ nationality: 'Brasil', index: i, random: rng(7 + i) });
    const quantos = nome.split(' ').filter(x => SUFIXOS.includes(x)).length;
    assert.ok(quantos <= 1, `sufixo empilhado: "${nome}"`);
  }
});

teste('sufixo sobre sobrenome e sobre nome sozinho são ambos válidos', () => {
  // "João Silva Júnior" — o pai se chama João Silva.
  // "João Júnior"      — nome só com primeiro, comum em registro civil.
  // O sufixo fala dos pais, não de alguém do elenco: nenhum dos dois exige
  // homônimo no time para fazer sentido.
  const vistos = new Set();
  let sobreNome = 0;
  let sobreNomeSozinho = 0;
  for (let i = 0; i < 60000; i += 1) {
    const p = rollPlayerName({ nationality: 'Brasil', index: i, random: rng(13 + i) }).split(' ');
    if (!p.some(x => SUFIXOS.includes(x))) continue;
    vistos.add(p.join(' '));
    if (p.length >= 3) sobreNome += 1;
    else sobreNomeSozinho += 1;
  }
  assert.ok(sobreNome > 0, 'ninguém ficou com sufixo sobre sobrenome');
  assert.ok(sobreNomeSozinho > 0, 'ninguém ficou com sufixo sobre nome sozinho');
  console.log(`      (${sobreNome} sobre sobrenome, ${sobreNomeSozinho} sobre nome sozinho)`);
});

teste('segundo sobrenome na taxa brasileira medida', () => {
  const N = 20000;
  let comSegundo = 0;
  for (let i = 0; i < N; i += 1) {
    const p = rollPlayerName({ nationality: 'Brasil', index: i, random: rng(31 + i) }).split(' ');
    if (p.filter(x => !SUFIXOS.includes(x)).length >= 3) comSegundo += 1;
  }
  const taxa = comSegundo / N;
  // Subiu de 12% para 55%. No censo brasileiro o nome padrão é
  // primeiro + sobrenome da mãe + sobrenome do pai, e a maioria leva os dois.
  assert.ok(taxa > 0.48 && taxa < 0.62, `taxa de 2º sobrenome fora da faixa: ${taxa.toFixed(4)}`);
});

teste('nenhum nome colado sobrevive no pool inteiro', () => {
  // "JoséJose" veio da fonte do IBGE: duas células coladas, uma com acento e
  // outra sem. A checagem existia, mas comparava o texto cru — "José" nunca
  // era igual a "Jose", então nunca disparava para o caso que eu escrevi.
  const d = JSON.parse(readFileSync('js/data/nomes-jogadores.json', 'utf8'));
  for (const [nacao, pool] of Object.entries(d.pools)) {
    for (const lista of ['primeiros', 'sobrenomes', 'segundosSobrenomes', 'sufixos']) {
      const presentes = new Set((pool[lista] || []).map(chaveSemAcento));
      for (const nome of pool[lista] || []) {
        const bruto = nome.replace(/\s/g, '');
        if (bruto.length % 2 !== 0 || bruto.length < 6) continue;
        const meio = bruto.length / 2;
        const a = chaveSemAcento(bruto.slice(0, meio));
        const b = chaveSemAcento(bruto.slice(meio));
        const colado = a === b && presentes.has(a) && presentes.has(b);
        assert.ok(!colado, `${nacao}/${lista}: nome colado "${nome}"`);
      }
    }
  }
});

teste('a checagem de nome colado não come nome real', () => {
  // Estes quatro têm "metade repetida" e são nomes de verdade. Uma checagem
  // genérica pegaria 6 nomes e mataria 4 legítimos — foi o que medi antes de
  // decidir que a regra precisava das duas guardas.
  const d = JSON.parse(readFileSync('js/data/nomes-jogadores.json', 'utf8'));
  const salvos = [
    ['Brasil', 'primeiros', 'Nenê'],
    ['Brasil', 'primeiros', 'Tatá'],
    ['Sérvia', 'primeiros', 'Saša'],
    ['Sudeste Asiático', 'primeiros', 'Anan'],
    ['Equador', 'sobrenomes', 'Guagua'],
  ];
  for (const [nacao, lista, nome] of salvos) {
    const achou = (d.pools[nacao][lista] || []).includes(nome);
    assert.ok(achou, `${nacao}/${lista}: "${nome}" foi removido e é nome real`);
  }
});

let passou = 0;
let falhou = 0;
console.log('sufixo como camada\n');
for (const [nome, fn] of testes) {
  try {
    fn();
    passou += 1;
    console.log(`V ${nome}`);
  } catch (erro) {
    falhou += 1;
    console.log(`X ${nome}`);
    console.log(`    ${erro.message}`);
  }
}
console.log(`\nsufixo-camada: ${passou} passed, ${falhou} failed`);
if (falhou) process.exit(1);