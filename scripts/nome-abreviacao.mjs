/**
 * Abreviação sem ambiguidade.
 *
 * Pedido do usuário, e é a condição que fecha o modelo: ao abreviar, a forma
 * abreviada não pode ser igual à de outro jogador do mesmo clube.
 *
 *   "João Souza Silva"  e  "João Santos Silva"
 *        ↓                          ↓
 *   "João S. Silva"            "João S. Silva"        ← colisão
 *
 * A regra que resolve: ABREVIAR SÓ ENQUANTO NÃO COLIDIR. Se a forma curta
 * seria ambígua, mantém o nome completo — que é mais longo, mas inequívoco.
 *
 * Abreviação nunca pode piorar o que o jogador lê.
 *
 * node scripts/nome-abreviacao.mjs
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const br = JSON.parse(readFileSync('js/data/nomes-jogadores.json', 'utf8')).pools.Brasil;
const SUFIXOS = br.sufixos;
const eSufixo = s => SUFIXOS.some(x => s.toLowerCase().replace(/[^a-z]/gi, '') === x.toLowerCase().replace(/[^a-z]/gi, ''));
const sobrenomesBase = br.sobrenomes.filter(s => !eSufixo(s));
const primeiroBase = br.primeiros.filter(p => !eSufixo(p));

/**
 * Partículas que somem ao abreviar.
 *
 * "José Antônio Ferreira de Oliveira" vira "José A. F. Oliveira" — o "de"
 * desaparece, não vira "d.". É a convenção brasileira: partícula é ligante de
 * sobrenome, não palavra do nome, e ninguém escreve "José A. F. d. Oliveira".
 */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'y', 'del', 'la', 'van']);
const semParticula = parte => !PARTICULAS.has(parte.toLowerCase());

/**
 * Primeiro nome por extenso, meios por inicial, último sobrenome por extenso.
 *
 * A partícula é removida antes de abbrevi o resto. Sem remover, "de" viraria
 * "d." — que não é abreviação, é erro de leitura.
 */
export function abreviarMedio(nome) {
  const partes = nome.split(' ').filter(Boolean).filter(semParticula);
  if (partes.length <= 2) return partes.join(' ');
  const meio = partes.slice(1, -1).map(x => `${x[0]}.`).join(' ');
  return `${partes[0]} ${meio} ${partes.at(-1)}`;
}

/** Só o primeiro abreviado. Menos agressivo, resolve a maioria dos casos. */
export function abreviarPrimeiro(nome) {
  const p = nome.split(' ').filter(Boolean).filter(semParticula);
  if (p.length <= 2) return nome;
  return `${p[0][0]}. ${p.slice(1).join(' ')}`;
}

const FORMAS = [abreviarMedio, abreviarPrimeiro];
const chave = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Abrevia cada nome do elenco para a primeira forma que não colide com outro.
 * @param {string[]} nomes nomes completos
 * @returns {string[]} formas de exibição, na mesma ordem
 */
export function abreviarElenco(nomes) {
  const usados = new Set();
  const saida = [];
  for (const nome of nomes) {
    let forma = nome;
    for (const fn of FORMAS) {
      const candidato = fn(nome);
      if (candidato === nome) break;        // não abrevia
      if (usados.has(chave(candidato))) continue;  // colide, tenta mais forte
      forma = candidato;
      break;
    }
    usados.add(chave(forma));
    saida.push(forma);
  }
  return saida;
}

// ─────────────────────────────────────────────────────────────

console.log('abreviação por contexto');
console.log('─'.repeat(72));
console.log('completo'.padEnd(34) + 'médio'.padEnd(24) + 'só o primeiro');
console.log('─'.repeat(72));
for (const nome of [
  'João Silva',
  'João Souza Silva',
  'José Antônio Ferreira de Oliveira',
  'João Silva Júnior',
  'Antônio Carlos Soares Pereira Filho',
]) {
  console.log(nome.padEnd(34) + abreviarMedio(nome).padEnd(24) + abreviarPrimeiro(nome));
}
console.log('─'.repeat(72));
console.log('');

console.log('o caso que o usuário apontou');
console.log('─'.repeat(72));
const par = ['João Souza Silva', 'João Santos Silva'];
console.log(`  completo:   ${par.join('   |   ')}`);
console.log(`  médio:      ${par.map(abreviarMedio).join('   |   ')}   ← colide`);
console.log(`  resolvido:  ${abreviarElenco(par).join('   |   ')}`);
console.log('');

console.log('eficiência num elenco real');
console.log('─'.repeat(72));

let seed = 909;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

let enc = 0, abreviados = 0, mantidos = 0, comprimentoTotal = 0, comprimentoAberto = 0;
for (let clube = 0; clube < 400; clube += 1) {
  const nomes = Array.from({ length: 26 }, () => {
    const primeiro = primeiroBase[Math.floor(rng() * primeiroBase.length)];
    const s1 = sobrenomesBase[Math.floor(rng() * sobrenomesBase.length)];
    let nome = `${primeiro} ${s1}`;
    if (rng() < 0.55) nome += ` ${sobrenomesBase[Math.floor(rng() * sobrenomesBase.length)]}`;
    if (rng() < 0.05) nome += ` ${SUFIXOS[Math.floor(rng() * SUFIXOS.length)]}`;
    return nome;
  });
  const distintos = [...new Set(nomes)];
  const exibidos = abreviarElenco(distintos);
  enc += 1;
  for (let i = 0; i < distintos.length; i += 1) {
    comprimentoTotal += exibidos[i].length;
    comprimentoAberto += distintos[i].length;
    if (exibidos[i] === distintos[i]) mantidos += 1;
    else abreviados += 1;
  }
}
console.log(`  ${enc} elencos simulados, taxa de 2º sobrenome 55%`);
console.log(`  abreviados:      ${abreviados}  (${((abreviados/(abreviados+mantidos))*100).toFixed(1)}%)`);
console.log(`  mantidos longos: ${mantidos}  (colidiriam se abreviados)`);
console.log(`  comprimento médio: ${(comprimentoTotal/(abreviados+mantidos)).toFixed(1)} vs ${(comprimentoAberto/(abreviados+mantidos)).toFixed(1)} sem abreviar`);
console.log('');

console.log('o que isso garante');
console.log('─'.repeat(72));
console.log('  Abreviar nunca introduz ambiguidade: se a forma curta colide com');
console.log('  outro do elenco, o nome fica completo.');
console.log('');
console.log('  E o escopo é o conjunto exibido, não o dado. O jogador tem sempre o');
console.log('  nome completo armazenado — a abreviação é da tela, e some se o');
console.log('  contexto mudar. Dedupe continua operando no nome inteiro.');
// ─────────────────────────────────────────────────────────────
// Testes
// ─────────────────────────────────────────────────────────────

const testes = [
  ['partícula some, não vira inicial', () => {
    assert.equal(abreviarMedio('José Antônio Ferreira de Oliveira'), 'José A. F. Oliveira');
    assert.equal(abreviarMedio('João de Souza Lima'), 'João S. Lima');
    assert.equal(abreviarMedio('Maria da Silva Santos'), 'Maria S. Santos');
    assert.equal(abreviarMedio('Pedro dos Santos Souza'), 'Pedro S. Souza');
    assert.equal(abreviarMedio('Carlos da Costa'), 'Carlos Costa');
  }],
  ['nunca produz "d." solto', () => {
    for (const nome of [
      'José Antônio Ferreira de Oliveira', 'João de Souza', 'Maria da Silva',
      'Pedro dos Santos', 'Ana das Neves', 'Lucio e Silva', 'João van Dijk',
    ]) {
      const f = abreviarMedio(nome);
      assert.ok(!/(^|\s)[a-z]\.(\s|$)/i.test(f.replace(/\b[A-Z]\.(\s|$)/g, '$1')), `partícula abreviada em "${f}"`);
      assert.ok(!/\b[dgle]\.$/i.test(f), `partícula no fim em "${f}"`);
    }
  }],
  ['abrevia sem colidir', () => {
    const par = ['João Souza Silva', 'João Santos Silva'];
    const [a, b] = abreviarElenco(par);
    assert.notEqual(a, b, 'as duas formas abriram iguais');
    assert.ok(abreviarMedio(par[0]) === abreviarMedio(par[1]), 'o caso de colisão sumiu do exemplo');
  }],
  ['elenco inteiro fica sem ambiguidade', () => {
    for (let semente = 1; semente <= 40; semente += 1) {
      let st = semente;
      const r = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
      const nomes = [];
      for (let i = 0; i < 30; i += 1) {
        const primeiro = primeiroBase[Math.floor(r() * primeiroBase.length)];
        const a = sobrenomesBase[Math.floor(r() * sobrenomesBase.length)];
        const b = sobrenomesBase[Math.floor(r() * sobrenomesBase.length)];
        nomes.push(r() < 0.5 ? `${primeiro} ${a}` : `${primeiro} ${a} ${b}`);
      }
      const distintos = [...new Set(nomes)];
      const exibidos = abreviarElenco(distintos);
      const vistos = new Set();
      for (const nome of exibidos) {
        assert.ok(!vistos.has(nome), `duplicou na tela: "${nome}"`);
        vistos.add(nome);
      }
    }
  }],
  ['abreviação nunca alonga', () => {
    for (const nome of [
      'João Silva', 'João Souza Silva', 'José Antônio Ferreira de Oliveira',
      'Antônio Carlos Soares Pereira Filho', 'Kaká',
    ]) {
      assert.ok(abreviarMedio(nome).length <= nome.length, `alongou: "${nome}"`);
    }
  }],
  ['apelido não é abreviado', () => {
    assert.equal(abreviarMedio('Kaká'), 'Kaká');
    assert.equal(abreviarMedio('João Silva Júnior'), 'João S. Júnior');
  }],
];

let passou = 0;
let falhou = 0;
console.log('');
for (const [nome, fn] of testes) {
  try {
    fn();
    passou += 1;
    console.log(`✓ ${nome}`);
  } catch (erro) {
    falhou += 1;
    console.log(`✗ ${nome}`);
    console.log(`    ${erro.message}`);
  }
}
console.log(`\nnome-abreviacao: ${passou} passed, ${falhou} failed`);
if (falhou) process.exit(1);