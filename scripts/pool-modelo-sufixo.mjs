/**
 * Proposta de modelo para o sufixo, e quanto de pool ele libera.
 *
 * Correção do usuário, que está certo e o modelo anterior errava:
 *
 *   O sufixo NÃO é sobrenome. É aplicado SOBRE O NOME DO PAI.
 *     "João Júnior"        — filho de um João
 *     "João Silva Júnior"  — filho de um João Silva
 *
 *   E nunca se empilha: "Júnior Júnior", "Filho Filho", "Neto Neto" e
 *   qualquer mescla são proibidos.
 *
 * Consequência: o sufixo sai de ser uma vaga fixa na lista de sobrenomes e
 * vira uma CAMADA. Camada multiplica o espaço; vaga occupied só o divide.
 *
 * node scripts/pool-modelo-sufixo.mjs
 */
import { readFileSync } from 'node:fs';

const br = JSON.parse(readFileSync('js/data/nomes-jogadores.json', 'utf8')).pools.Brasil;
const SUFIXOS = br.sufixos;
const eSufixo = s => SUFIXOS.some(x => s.toLowerCase() === x.toLowerCase());

const F = br.primeiros.length;
const S = br.sobrenomes.filter(s => !eSufixo(s)).length;
const hoje = F * br.sobrenomes.length;

const espacos = taxa => {
  const semSufixo = F * S * (1 + taxa) + F; // + "João" sem sobrenome nenhum
  return { semSufixo, total: semSufixo * (1 + SUFIXOS.length) };
};

console.log('=== 1. o modelo ===');
console.log('');
console.log('  nome  =  [primeiro] [sobrenome] [segundo sobrenome?] [sufixo?]');
console.log('');
console.log('  Componente forbidden:');
console.log('    - sobrenome nunca é um sufixo (Filho/Júnior/Neto saem da lista)');
console.log('    - no máximo um sufixo por nome');
console.log('');
console.log('  Formas possíveis:');
console.log('    "João Silva"            sem sufixo');
console.log('    "João Souza Silva"      dois sobrenomes');
console.log('    "João"                  só primeiro nome');
console.log('    "João Júnior"           só primeiro + sufixo');
console.log('    "João Silva Júnior"     primeiro + sobrenome + sufixo');
console.log('');

console.log('=== 2. proibições resolvidas por construção ===');
console.log('');
console.log('  "João Júnior Júnior"      impossível — a base nunca usa componente de sufixo');
console.log('  "João Silva Filho Filho"  impossível — no máximo um sufixo é anexado');
console.log('  "João Júnior Filho"       impossível — idem');
console.log('  Não é filtro: é ausência de caminho que produza a string.');
console.log('');

console.log('=== 3. quanto de pool isso libera ===');
console.log('');
console.log(`  hoje: ${F} primeiros x ${br.sobrenomes.length} sobrenomes = ${hoje.toLocaleString('pt-BR')}`);
console.log(`  sem os 2 sufixos na lista: ${F} x ${S} = ${(F * S).toLocaleString('pt-BR')}`);
console.log('');

const TABELA = [
  ['12% (o que o jogo usa hoje)', 0.12],
  ['30%', 0.30],
  ['55% (realidade brasileira)', 0.55],
  ['70%', 0.70],
];

console.log('  taxa de 2º sobrenome      sem sufixo      total com camada de sufixo');
console.log('  ' + '─'.repeat(64));
for (const [rotulo, taxa] of TABELA) {
  const { semSufixo, total } = espacos(taxa);
  console.log(
    `  ${rotulo.padEnd(24)}${Math.round(semSufixo).toLocaleString('pt-BR').padStart(13)}` +
    `${Math.round(total).toLocaleString('pt-BR').padStart(26)}`,
  );
}
console.log('  ' + '─'.repeat(64));

const recomendado = espacos(0.55);
console.log('');
console.log(`  recomendado (55% de segundo sobrenome): ${Math.round(recomendado.total).toLocaleString('pt-BR')}`);
console.log(`  contra os ${hoje.toLocaleString('pt-BR')} de hoje: ${(recomendado.total / hoje).toFixed(1)}x`);
console.log('');

console.log('=== 4. por que 55% ===');
console.log('');
console.log('  O nome brasileiro padrão é primeiro + sobrenome da mãe + sobrenome');
console.log('  do pai. Quem tem os dois pais com registro leva os dois sobrenomes —');
console.log('  a grande maioria. Os 12% de hoje subestimam o espaço de nomes por um');
console.log('  fator de quase 5.');
console.log('');
console.log('  O que muda no jogo:');
console.log('    - "João Souza Silva" passa a ser comum, que é o certo');
console.log('    - o painel de elenco fica mais realista');
console.log('    - a colisão dentro de um clube cai ainda mais');
console.log('');
console.log('  Risco: nome de 3 palavras é mais longo e pode quebrar layout estreito.');
console.log('  O limite de 40 caracteres já existe em validatePlayerRename e');
console.log('  precisa continuar valendo aqui também.');