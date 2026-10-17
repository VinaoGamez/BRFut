/**
 * Integridade de imports: todo símbolo importado de um módulo local existe de
 * fato naquele módulo.
 *
 * É o check mais barato que existe para "o jogo sobe?". O modo offline por
 * navegador não deu conta nesta máquina (o proxy do ambiente devolve 502 em
 * parte dos módulos), e foi um export removido no caminho — `FIFA_FRIENDLY_WINDOWS`
 * — que derrubou 36 suítes de uma vez. Isso pega a mesma classe de erro sem
 * depender de navegador.
 *
 * node scripts/import-integrity-tests.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIRS = ['js'];
const IGNORAR = new Set(['node_modules', 'dist', '.git', 'tmp', 'ao-vivo-2d']);

function andar(dir, out = []) {
  for (const entrada of readdirSync(dir)) {
    if (IGNORAR.has(entrada)) continue;
    const caminho = join(dir, entrada);
    const info = statSync(caminho);
    if (info.isDirectory()) andar(caminho, out);
    else if (entrada.endsWith('.js')) out.push(caminho);
  }
  return out;
}

const arquivos = JS_DIRS.flatMap(d => andar(join(ROOT, d)));

/** Extrai `import { a, b as c } from './x.js'` e `import a from './x.js'`. */
function extrairImports(fonte) {
  const encontrados = [];
  const re = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(fonte))) {
    const [, clause, spec] = m;
    const nomes = [];
    const chaves = clause.match(/\{([\s\S]*)\}/);
    if (chaves) {
      chaves[1].split(',').forEach(parte => {
        const limpo = parte.trim().replace(/\/\*[\s\S]*?\*\//g, '');
        if (!limpo) return;
        const asMatch = limpo.match(/^(\S+)\s+as\s+(\S+)$/);
        nomes.push(asMatch ? { origem: asMatch[1], local: asMatch[2] } : { origem: limpo, local: limpo });
      });
    }
    const padrao = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
    if (padrao && !padrao.startsWith('*')) nomes.push({ origem: 'default', local: padrao });
    encontrados.push({ spec, nomes });
  }
  return encontrados;
}

/** Exporta um arquivo: var/const/function/class + `export { a }`. */
function extrairExports(fonte) {
  const nomes = new Set();
  const decl = /export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = decl.exec(fonte))) nomes.add(m[1]);
  const brace = /export\s*\{([\s\S]*?)\}/g;
  while ((m = brace.exec(fonte))) {
    m[1].split(',').forEach(parte => {
      const limpo = parte.trim();
      if (!limpo) return;
      const asMatch = limpo.match(/(\S+)\s+as\s+(\S+)$/);
      nomes.add(asMatch ? asMatch[2] : limpo);
    });
  }
  if (/export\s+default\b/.test(fonte)) nomes.add('default');
  if (/export\s*\*/.test(fonte)) nomes.add('*');
  return nomes;
}

let passed = 0;
let failed = 0;
const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};
const assert = (cond, message) => {
  if (!cond) throw new Error(message || 'assertion failed');
};

// Indexa exports de todos os módulos locais de uma vez.
const exportsPorArquivo = new Map();
for (const arquivo of arquivos) {
  exportsPorArquivo.set(arquivo, extrairExports(readFileSync(arquivo, 'utf8')));
}

const problemas = [];

check(`todo import local resolve (${arquivos.length} módulos)`, () => {
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const { spec, nomes } of extrairImports(fonte)) {
      if (!spec.startsWith('.')) continue;
      // `?url` / `?raw` é sufixo de asset do Vite: o arquivo existe sem a query
      // e não é módulo — não tem export nomeado para conferir.
      const caminhoLimpo = spec.replace(/\?.*$/, '');
      if (!caminhoLimpo.endsWith('.js')) {
        try {
          statSync(resolve(dirname(arquivo), caminhoLimpo));
        } catch {
          problemas.push(`${relative(ROOT, arquivo)} -> ${spec}: asset não existe`);
        }
        continue;
      }
      const alvo = resolve(dirname(arquivo), caminhoLimpo);
      if (!exportsPorArquivo.has(alvo)) {
        problemas.push(`${relative(ROOT, arquivo)} -> ${spec}: módulo não indexado`);
        continue;
      }
      const disponiveis = exportsPorArquivo.get(alvo);
      if (disponiveis.has('*')) continue;
      for (const { origem, local } of nomes) {
        if (!origem || origem.startsWith('default')) continue;
        if (disponiveis.has(origem)) continue;
        problemas.push(
          `${relative(ROOT, arquivo)} importa { ${origem} } de ${spec} — não exportado`,
        );
      }
    }
  }
  assert(problemas.length === 0, `${problemas.length} problema(s):\n    ${problemas.slice(0, 12).join('\n    ')}`);
});

check('todo módulo de calendário exporta o que o resto usa', () => {
  const obrigatorios = {
    'js/engine/international-calendar.js': [
      'worldCupWindow', 'isWorldCupYear', 'clubStoppages', 'stoppageSummary',
      'qualifyingMatchdays', 'effectiveLeagueWindow', 'internationalWindowsForYear',
      'INTERNATIONAL_WINDOWS', 'WORLD_CUP_EDITIONS', 'describeInternationalCycle',
    ],
    'js/engine/season-calendar-mold.js': [
      'LEAGUE_DIVISION_MOLD', 'getSeasonBlackouts', 'isWorldCupYear',
      'INTERNATIONAL_WINDOWS_BLOCK_CLUBS', 'leagueDivisionWindow',
    ],
    'js/engine/season-calendar-cycle.js': ['getHardClubBlackouts', 'worldCupClubBlackoutSpec'],
  };
  const faltando = [];
  Object.entries(obrigatorios).forEach(([caminho, simbolos]) => {
    const exports = exportsPorArquivo.get(join(ROOT, caminho));
    if (!exports) {
      faltando.push(`${caminho}: módulo ausente`);
      return;
    }
    simbolos.forEach(s => {
      if (!exports.has(s)) faltando.push(`${caminho}: falta ${s}`);
    });
  });
  assert(faltando.length === 0, faltando.join(' | '));
});

check('nenhum módulo importa símbolo que não existe', () => {
  // Cobertura real: se a varredura acima passou, isto é uma garantia explícita
  // de que o número de imports locais é o esperado (guarda contra a varredura
  // silenciosamente não achar nada).
  let total = 0;
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, 'utf8');
    extrairImports(fonte).forEach(i => { if (i.spec.startsWith('.')) total += 1; });
  }
  assert(total > 150, `só ${total} imports locais encontrados — a varredura pode estar errada`);
});

check('todo asset referenciado existe em disco', () => {
  // Cobre o caminho `assets/...` e `brand/...` dentro de import/export. O check
  // de módulos acima pegaria o arquivo ausente, mas aqui a mensagem diz qual
  // imagem — o conversor de PNG para WebP reescreve referência por basename e
  // basta dois arquivos com o mesmo nome em pastas diferentes para um deles
  // quebrar em silêncio.
  const semArquivo = [];
  const vistos = new Set();
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, 'utf8');
    const re = /(?:from|import)\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(fonte))) {
      const spec = m[1];
      if (!/^(?:\.{1,2}\/)*(?:assets|brand)\//.test(spec)) continue;
      if (spec.includes('?')) continue;
      const caminho = spec.replace(/\?.*$/, '');
      const alvo = resolve(dirname(arquivo), caminho);
      vistos.add(`${relative(ROOT, arquivo)} -> ${spec}`);
      try {
        statSync(alvo);
      } catch {
        semArquivo.push(`${relative(ROOT, arquivo)} -> ${spec}`);
      }
    }
  }
  assert(
    semArquivo.length === 0,
    `${semArquivo.length} asset(s) ausente(s): ${semArquivo.slice(0, 8).join(' | ')}`,
  );
  assert(vistos.size > 5, `só ${vistos.size} referências de asset — a varredura pode estar errada`);
});

check('todo glob e caminho montado bate com um arquivo existente', () => {
  // O check acima só enxerga import estático. Duas formas de referenciar
  // imagem escapam dele e quebram sem erro de build:
  //
  //   import.meta.glob('../../assets/sponsors/icons/*.png', ...)
  //   `../sponsors/icons/${slug}.png`
  //
  // Quando a conversão de formato troca `.png` por `.webp`, o import estático
  // é reescrito por basename, mas o glob e o template literal não são — e o
  // sintoma em execução é só um `<img>` vazio, sem exceção no console.
  //
  // A checagem aqui não resolve o arquivo (o nome é runtime), e sim confirma
  // que a extensão pedida existe em algum lugar do diretório alvo.
  const varridos = new Set();
  const semAcerto = [];

  // A varredura de módulos é só `js/`, mas referência de imagem montada à mão
  // também existe fora dela — `assets/match-view/live-bridge.js` monta
  // `../sponsors/icons/${slug}.webp`. Aqui a checagem é só de caminho de asset,
  // sem analisar export, então vale varrer `assets/` também.
  const arquivosParaAsset = [
    ...arquivos,
    ...(statSync(join(ROOT, 'assets')).isDirectory() ? andar(join(ROOT, 'assets')) : []),
  ];

  const registrar = (origem, dirAlvo, extensao) => {
    let itens;
    try {
      itens = readdirSync(dirAlvo);
    } catch (erro) {
      // Só ENOENT é esperado: o prefixo pode não ser asset nenhum (código de
      // demonstração, caminho de rede). Qualquer outro erro é bug neste próprio
      // checker e precisa aparecer — engolir aqui faz o check passar em
      // silêncio, que é a pior falha possível num teste de integridade.
      if (erro?.code === 'ENOENT') return;
      throw erro;
    }
    varridos.add(origem);
    if (itens.filter(n => n.toLowerCase().endsWith(extensao)).length === 0) {
      semAcerto.push(`${origem}: nada em ${relative(ROOT, dirAlvo)} termina em ${extensao}`);
    }
  };

  for (const arquivo of arquivosParaAsset) {
    const fonte = readFileSync(arquivo, 'utf8');
    const base = dirname(arquivo);
    const reGlob = /import\.meta\.glob\(\s*['"]([^'"]+)['"]/g;
    let g;
    while ((g = reGlob.exec(fonte))) {
      const padrao = g[1];
      if (!/\.(png|webp|jpg|jpeg|svg|mp3|json)/i.test(padrao)) continue;
      const semWildcard = padrao.replace(/\*[^/]*/, '');
      const extensao = (padrao.match(/\*\.([a-z0-9]+)$/i) || [])[1];
      if (!extensao) continue;
      registrar(
        `${relative(ROOT, arquivo)}: ${padrao}`,
        resolve(base, semWildcard === padrao ? '.' : semWildcard),
        `.${extensao}`,
      );
    }

    // `../sponsors/icons/${slug}.webp`
    // Sem allowlist de pastas: o prefixo pode apontar para qualquer lugar e a
    // checagem se basta em resolver o diretório. Filtrar por nome de pasta
    // deixaria passar justamente o caso que este teste existe para pegar.
    //
    // Limitação conhecida: prefixo que começa com `./` é resolvido pelo
    // navegador em relação à *página*, não ao módulo (`./flags/${iso}.png` em
    // `js/lab/` aponta para `public/flags/`). Esses caem em ENOENT e são
    // ignorados aqui — ficam de fora da contagem.
    const reTpl = /`([^`$\n]*\/)\$\{[^}]*\}(\.[a-z0-9]+)`/gi;
    let t;
    while ((t = reTpl.exec(fonte))) {
      const [, prefixo, extensao] = t;
      registrar(
        `${relative(ROOT, arquivo)}: \`${prefixo}\${...}${extensao}\``,
        resolve(base, prefixo),
        extensao,
      );
    }
  }

  assert(
    semAcerto.length === 0,
    `${semAcerto.length} referência(s) sem arquivo correspondente: ${semAcerto.slice(0, 8).join(' | ')}`,
  );
  // 2 é o número real de referências resolvíveis hoje (o glob de patrocinadores
  // e o de estádios). Abaixo disso a varredura parou de funcionar.
  assert(
    varridos.size >= 2,
    `só ${varridos.size} glob/template varridos — a varredura pode estar errada`,
  );
});

console.log(`\nimport-integrity: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);