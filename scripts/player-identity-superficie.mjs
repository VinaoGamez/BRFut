/**
 * Superfície completa de dados de jogador indexados por NOME.
 *
 * Uso: node scripts/player-identity-superficie.mjs
 *
 * A pergunta não é "quantas linhas usam nome" (isso é normal, nome é exibição).
 * É: onde o nome é a **CHAVE** — o que se perde quando o jogador é renomeado.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORAR = new Set(['node_modules', 'dist', 'release', '.git', 'tmp', 'ao-vivo-2d', 'lab']);

function andar(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (IGNORAR.has(e)) continue;
    const c = join(dir, e);
    if (statSync(c).isDirectory()) andar(c, out);
    else if (e.endsWith('.js')) out.push(c);
  }
  return out;
}

const arquivos = andar(join(ROOT, 'js'));

// Padrões onde o NOME é a chave primária do dado.
const PADROES = [
  {
    rotulo: 'Map por nome do jogador',
    re: /\.set\(\s*(?:\w+\.)?name\s*,|new Map\(\[\[[^\]]*\.name/g,
  },
  {
    rotulo: 'busca em roster por nome',
    re: /roster\.find\([^)]*\.name\s*===/g,
  },
  {
    rotulo: 'registro { name } sem playerId',
    re: /\{\s*name:\s*[^}]*?(?<!,)\}/g,
  },
  {
    rotulo: 'estado da partida por nome',
    re: /state\.(fatigue|cards|injuries|minutesPlayed)\.(get|set|has)\(/g,
  },
  {
    rotulo: 'persistencia por nome (fatigue/scored)',
    re: /savedSeason\.(fatigue|scorers|assistants)|\[playerName\]|\[entry\.name\]/g,
  },
  {
    rotulo: 'leaderboard casa por nome',
    re: /item\.name\s*===\s*(goal|saved|person|player)\.name|\.club\s*===\s*\w+\.club\s*&&\s*\w+\.name\s*===/g,
  },
];

console.log('dados de jogador indexados por NOME (o que a renomeacao quebra)');
console.log('═'.repeat(78));
console.log('categoria'.padEnd(38) + 'ocorrências'.padStart(12) + 'arquivos'.padStart(11));
console.log('═'.repeat(78));

let totalGeral = 0;
const porPadrao = [];

for (const { rotulo, re } of PADROES) {
  let n = 0;
  const atingidos = new Set();
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, 'utf8');
    const m = fonte.match(re);
    if (m) {
      n += m.length;
      atingidos.add(relative(ROOT, arquivo));
    }
  }
  totalGeral += n;
  porPadrao.push({ rotulo, n, arquivos: atingidos.size });
  console.log(rotulo.padEnd(38) + String(n).padStart(12) + String(atingidos.size).padStart(11));
}

console.log('═'.repeat(78));
console.log('total'.padEnd(38) + String(totalGeral).padStart(12));
console.log('');

// Onde o bug e mais visivel: o arquivo com mais ocorrencias.
console.log('arquivos mais expostos:');
const porArquivo = new Map();
for (const arquivo of arquivos) {
  const fonte = readFileSync(arquivo, 'utf8');
  let n = 0;
  for (const { re } of PADROES) n += (fonte.match(re) || []).length;
  if (n > 0) porArquivo.set(relative(ROOT, arquivo), n);
}
for (const [arq, n] of [...porArquivo].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(3)}  ${arq}`);
}

console.log('');
console.log('--- o que some quando o jogador e renomeado ---');
console.log('  cartoes da partida (state.cards)      -> Map por nome');
console.log('  lesões adiadas (deferredInjuries)      -> lista por nome');
console.log('  fadiga/faltas por rodada               -> Map por nome');
console.log('  artilheiros e assistências da temporada -> casados por club+name');
console.log('  arquivo de temporada (season-archive)   -> slimLeaders descarta playerId');
console.log('');
console.log('Nenhum desses e erro visível: o jogador simply "para de aparecer"');
console.log('nas estatísticas, sem aviso no console.');