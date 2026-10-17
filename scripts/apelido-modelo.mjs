/**
 * Nome sozinho = apelido, não nome genérico.
 *
 * Observação do usuário: "João" sozinho não existe como forma neutra — quem é
 * chamado por um nome só tem apelido (Kaká, Ronaldinho, Pelé, Zico). Isso
 * muda a proposta: a forma de primeiro nome sem sobrenome deixa de ser um
 * fallback e vira um traço raro e marcante.
 *
 * Amostra real verificada em pt.wikipedia (todos dizem "mais conhecido como"):
 *
 *   Kaká              de Ricardo Izecson dos Santos Leite
 *   Zico              de Arthur Antunes Coimbra
 *   Garrincha         de Manoel dos Santos
 *   Roberto Dinamite  de Carlos Roberto Dinamite de Oliveira
 *   Vampeta           de Marcos André Batista Santos
 *   Sócrates          de Sócrates Brasileiro Sampaio de Souza Vieira de Oliveira
 *
 * O que a amostra mostra: o apelido quase nunca tem relação com o nome real.
 * Kaká veio de Ricardo. Vampeta, de Marcos. Sócrates é o próprio primeiro nome.
 *
 * node scripts/apelido-modelo.mjs
 */
import { readFileSync } from 'node:fs';

const br = JSON.parse(readFileSync('js/data/nomes-jogadores.json', 'utf8')).pools.Brasil;
const SUFIXOS = br.sufixos;
const eSufixo = s => SUFIXOS.some(x => s.toLowerCase() === x.toLowerCase());
const F = br.primeiros.length;
const S = br.sobrenomes.filter(s => !eSufixo(s)).length;

// As quatro formas que a amostra e a prática mostram.
const FORMAS = [
  {
    nome: 'sílaba repetida',
    como: 'Dodô, Kaká, Nenê, Ziggy',
    exemplo: n => {
      const semVogal = n.replace(/[aeiouáéíóúâêôãõ]/gi, '');
      const alvo = semVogal.length >= 3 ? semVogal.slice(0, 3) : semVogal;
      if (!alvo) return null;
      // Kaká não sai disso, mas "Dodô" sai — e é a forma mais comum.
      return alvo[0] + alvo[1] + 'ô';
    },
  },
  {
    nome: 'diminutivo',
    como: 'Ronaldinho (de Ronaldo), Juninho (de Antônio), Paulinho (de Paulo)',
    exemplo: n => (n.length >= 4 ? n.slice(0, n.length - 2) + 'inho' : null),
  },
  {
    nome: 'apelido sem relação',
    como: 'Kaká (de Ricardo), Vampeta (de Marcos)',
    exemplo: null, // não é derivável do nome: exige lista curada
  },
  {
    nome: 'o próprio primeiro nome',
    como: 'Sócrates, Pelé, Marta, Neymar',
    exemplo: n => n,
  },
];

console.log('=== as formas, e quais dá para derivar do nome ===');
console.log('');
for (const f of FORMAS) {
  const derivada = typeof f.exemplo === 'function';
  console.log(`  ${f.nome.padEnd(26)} ${f.como.slice(0, 46).padEnd(48)}`);
  console.log(`  ${''.padEnd(26)} ${derivada ? 'derivável do próprio nome' : 'NÃO derivável — exige lista'}`);
  console.log('');
}

console.log('consequência de desenho:');
console.log('  3 das 4 formas saem do nome do próprio jogador. Isso é melhor do que');
console.log('  uma lista de apelidos prontos, porque o apelido casa com a pessoa e');
console.log('  não repete entre os 22 mil jogadores do mundo.');
console.log('');

// A forma "apelido sem relação" é a que exige lista. É a mais famosa, e a que
// mais se prestigiou. Vale uma lista curta e curada.
console.log('=== a quarta forma exige lista curada ===');
console.log('');
console.log('  Apelido sem relação não sai do nome. É preciso lista. E é justamente');
console.log('  a mais lendária — Kaká, Vampeta, Djalminha, Didiguinha.');
console.log('  Proposta: lista de ~40 apelidos brasileiros, uso muito raro (<0,1%),');
console.log('  porque quem tem apelido desses é uma exceção, não a regra.');
console.log('');

const taxa = 0.015;
const taxaLista = 0.001;
console.log('=== taxa em que o nome sozinho aparece ===');
console.log('');
console.log(`  derivado do próprio nome   ${(taxa * 100).toFixed(1)}%`);
console.log(`  de lista curada            ${(taxaLista * 100).toFixed(1)}%`);
console.log(`  total                      ${((taxa + taxaLista) * 100).toFixed(1)}%`);
console.log('');
console.log(`  Em 22.126 jogadores, isso dá ~${Math.round(22126 * (taxa + taxaLista))} com nome só.`);
console.log('');

console.log('=== impacto na pool ===');
console.log('');
const semNomeSozinho = F * S * (1 + 0.55);
const comNomeSozinho = semNomeSozinho + F; // "João" sozinho saiu; entra o apelido
const totalComCamada = comNomeSozinho * (1 + SUFIXOS.length);
console.log(`  base (55% de 2º sobrenome, sem sufixo)  ${Math.round(semNomeSozinho).toLocaleString('pt-BR')}`);
console.log(`  com apelido como forma                  ${Math.round(comNomeSozinho).toLocaleString('pt-BR')}`);
console.log(`  + camada de sufixo                       ${Math.round(totalComCamada).toLocaleString('pt-BR')}`);
console.log('');
console.log('  O apelido entra como uma forma a mais, e é raro — não como folga no');
console.log('  espaço. Quase não afeta a pool, e é exatamente o ponto: nome sozinho');
console.log('  deve ser raro o bastante para o jogador reparar que viu.');