/**
 * Gera `js/data/nomes-jogadores.json` a partir de fontes públicas.
 *
 * Procedência importa: nome inventado denuncia o gerador na hora. As listas
 * vêm do Censo Demográfico do IBGE 2022 (divulgado em 04/11/2025), que é a
 * mesma base do portal "Nomes no Brasil" do próprio IBGE.
 *
 * Rodar: node scripts/gerar-nomes.mjs [--dry-run]
 *
 * Sem `--dry-run`, escreve o JSON. O JSON é commitado — o script existe para
 * deixar a origem auditável e o arquivo reproduzível, não para rodar no build.
 */

import { BR_EXTRAS, POOLS_POR_PAIS, POOLS_REGIONAIS } from './nomes-regionais.mjs';

const WIKI_API = 'https://pt.wikipedia.org/w/api.php';
const UA = { 'User-Agent': 'brfut-names/1.0 (gerador de pools de nome)' };

async function wikitext(titulo) {
  const url = `${WIKI_API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(titulo)}`;
  const resp = await fetch(url, { headers: UA });
  if (!resp.ok) throw new Error(`${titulo}: HTTP ${resp.status}`);
  const json = await resp.json();
  const pagina = Object.values(json?.query?.pages ?? {})[0];
  return pagina?.revisions?.[0]?.slots?.main?.['*'] ?? '';
}

const semWiki = texto => texto.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
const limpar = texto =>
  semWiki(String(texto))
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

/** Nomes aceitam acento, espaço e apóstrofo ("Maria Eduanda", "D'Ávila"). */
const ehNome = nome =>
  /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ' .-]+$/.test(nome) && !/\d/.test(nome);

/**
 * O IBGE publica a mesma grafia mais de uma vez quando o registro aparece com
 * acentuação diferente: `JoséJose`, `Luiz  Luíz`, `André  André`. São linhas
 * reais da fonte e nomes plausíveis — o problema é que viram três entradas do
 * mesmo nome, e o gerador passa a devolver "JoséJose Ribeiro".
 */
function ehNomeUtil(nome) {
  if (!ehNome(nome)) return false;
  const normalizado = nome.replace(/\s+/g, ' ').trim();
  if (normalizado !== nome) return false;            // espaço duplo ou borda
  const partes = normalizado.split(' ');
  if (partes.length > 2) return false;               // nome composto demais
  const comparadas = new Set(partes.map(p => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  if (comparadas.size !== partes.length) return false; // "André André"
  // Grafia sem acento e com acento do mesmo nome, coladas: "JoséJose".
  const semEspaco = normalizado.replace(/\s/g, '').toLowerCase();
  const meio = Math.floor(semEspaco.length / 2);
  if (semEspaco.length % 2 === 0 && semEspaco.slice(0, meio) === semEspaco.slice(meio)) return false;
  return true;
}

/**
 * Extrai nomes das tabelas do IBGE (masculino).
 *
 * A cor da linha diz o sexo: `#ddeeff` (azul) = masculino, `#ffddee` (rosa) =
 * feminino. Só o masculino entra — o jogo não trata a categoria feminina, e
 * manter o resto no arquivo só占用 espaço.
 */
function extrairPrenomes(wikitext) {
  const masculino = [];
  let sexoAtual = null;
  const linhas = wikitext.split('\n');
  for (let i = 0; i < linhas.length; i += 1) {
    const cor = linhas[i].match(/background:(#\w{6})/);
    if (cor) {
      sexoAtual = cor[1] === '#ffddee' ? 'f' : cor[1] === '#ddeeff' ? 'm' : sexoAtual;
      continue;
    }
    const m = linhas[i].match(/^\|\s*'''(.*?)'''\s*$/);
    if (!m) continue;
    const nome = limpar(m[1]);
    if (!ehNomeUtil(nome)) continue;
    if (!/\{\{fmtn\|\d+/.test(linhas.slice(i + 1, i + 3).join('\n'))) continue;
    if (sexoAtual === 'm') masculino.push(nome);
  }
  return masculino;
}

function extrairSobrenomes(wikitext) {
  const sobrenomes = [];
  const linhas = wikitext.split('\n');
  for (let i = 0; i < linhas.length; i += 1) {
    const m = linhas[i].match(/^\|\s*'''(.*?)'''\s*$/);
    if (!m) continue;
    const sobrenome = limpar(m[1]);
    if (sobrenome.length < 3 || !ehNome(sobrenome)) continue;
    if (!/\{\{fmtn\|\d+/.test(linhas.slice(i + 1, i + 3).join('\n'))) continue;
    sobrenomes.push(sobrenome);
  }
  return sobrenomes;
}

const dedupe = lista => [...new Set(lista)];

const BR = {
  forma: 'primeiro-sobrenome',
  // Pt-BR usa um sobrenome; o segundo (materno) aparece em ~12% dos casos.
  segundosSobrenomes: ['Silva', 'Santos', 'Souza', 'Oliveira', 'Pereira', 'Rodrigues', 'Ferreira', 'Alves'],
  sufixos: ['Júnior', 'Neto', 'Filho'],
};

/** Nomes que não soam bertuguês numa pool de país. */
const SO_BRASILEIROS = new Set([
  'Thiago', 'Gabriel', 'Maicon', 'Marcelinho', 'Paulinho', 'Dudu', 'Emerson', 'Alex', 'Júnior',
  'Léo', 'Danilo', 'Douglas', 'Everton', 'Fabinho', 'Gilmar', 'Wesley', 'Rafael', 'Ricardo',
  'Rodrigo', 'Felipe', 'Diego', 'Bruno', 'Daniel', 'Paulo', 'Luiz', 'Anderson', 'Jean',
  'Benedito', 'Tatá', 'Manoel', 'Juninho', 'Nenê', 'Tiquinho', 'Dodô', 'Betinho', 'Lulinha',
  'Juninho', 'Rafinha', 'Tatuzinho', 'Gerson', 'Sidnei', 'Washington', 'Wagner', 'Cleber',
]);

/**
 * Sobrenomes que marcam origem portuguesa. Alguns existem também em Portugal e
 * Macau, mas em pool hispano soam errado tanto quanto.
 */
const SOBRENOMES_LUSOFONOS = new Set([
  'Silva', 'Santos', 'Souza', 'Oliveira', 'Pereira', 'Costa', 'Almeida', 'Coelho', 'Batista',
  'Ramos', 'Dantas', 'Pires', 'Gonçalves', 'Nascimento', 'Duarte', 'Machado', 'Azevedo', 'Cardoso',
  'Rocha', 'Barbosa', 'Teixeira', 'Correia', 'Moura', 'Freitas', 'Moraes', 'Moreira', 'Andrade',
  'Ferreira', 'Gomes', 'Ribeiro', 'Carvalho', 'Alves', 'Martins', 'Araújo', 'Monteiro',
]);

/** Pools onde não pode soar português. Só entra o que é falado lá. */
const HISPANOFONAS = new Set([
  'Argentina', 'Uruguai', 'Paraguai', 'Colombia', 'Venezuela', 'Equador', 'Chile', 'Espanha',
]);

/**
 * Rede de segurança: nas pools hispânicas, nomes que soam inequivocamente
 * brasileiros vazam do material de origem e produzem "Marcelinho Soares" na
 * Colômbia, que é exatamente o defeito que o pool por país veio para evitar.
 */
/**
 * Sobrenomes que tambem sao sufixo no jogo.
 *
 * Sao sobrenomes de verdade no IBGE — "Silva Filho" existe. Mas aqui eles
 * tem funcao propria: herdam o nome do pai. Ver `youth-inheritance.js`.
 */
const SOBRENOMES_QUE_SAO_SUFIXO = new Set(['Júnior', 'Junior', 'Filho', 'Neto']);

function filtrarPorPool(nacao, pool) {
  // O IBGE lista 'Júnior' e 'Filho' entre os sobrenomes, e são sobrenomes de
  // verdade. Mas aqui eles já têm função própria — são a lista de `sufixos`,
  // e significam "filho de alguém com esse nome".
  //
  // Deixá-los nos dois lugares produz "Paulo Silva Filho" sem nenhum "Paulo
  // Silva" no clube, o que não diz nada ao jogador. Nos sobrenomes eles só
  // entram acompanhados do nome que herdam.
  const base = {
    ...pool,
    sobrenomes: pool.sobrenomes.filter(nome => !SOBRENOMES_QUE_SAO_SUFIXO.has(nome)),
  };
  if (!HISPANOFONAS.has(nacao)) return base;
  return {
    ...base,
    primeiros: pool.primeiros.filter(nome => !SO_BRASILEIROS.has(nome)),
    sobrenomes: base.sobrenomes.filter(nome => !SOBRENOMES_LUSOFONOS.has(nome)),
  };
}

async function main() {
  console.log('buscando IBGE Censo 2022 via Wikipedia...');
  const textoPrenomes = await wikitext('Lista de prenomes mais comuns no Brasil');
  const textoSobrenomes = await wikitext('Lista de sobrenomes mais comuns no Brasil');

  const prenomesMasc = dedupe(extrairPrenomes(textoPrenomes));
  const sobrenomesBr = dedupe(extrairSobrenomes(textoSobrenomes));

  console.log(`  prenomes masculino: ${prenomesMasc.length}`);
  console.log(`  sobrenomes:          ${sobrenomesBr.length}`);
  console.log(`  amostra masculino: ${prenomesMasc.slice(0, 14).join(', ')}`);
  console.log(`  amostra sobrenomes: ${sobrenomesBr.slice(0, 12).join(', ')}`);

  if (prenomesMasc.length < 40 || sobrenomesBr.length < 30) {
    console.error('\nextração insuficiente — não escrever o arquivo.');
    process.exit(1);
  }

  // Extras vêm de `nomes-regionais.mjs`, nunca de `player-names.js`: este
  // gerador escreve o JSON que aquele módulo importa, e ler de lá seria ler a
  // própria saída — cada rodada reintroduziria o que a anterior filtrou.
  const pools = {
    Brasil: {
      ...BR,
      primeiros: dedupe([...prenomesMasc, ...BR_EXTRAS.primeiros].filter(ehNomeUtil)),
      sobrenomes: dedupe([...sobrenomesBr, ...BR_EXTRAS.sobrenomes].filter(ehNomeUtil)),
    },
    ...POOLS_POR_PAIS,
    ...POOLS_REGIONAIS,
  };
  // `nota` é comentário de fonte, não dado de pool.
  for (const [nacao, pool] of Object.entries(pools)) {
    delete pool.nota;
    pools[nacao] = filtrarPorPool(nacao, pool);
  }

  const saida = {
    _meta: {
      geradoEm: new Date().toISOString().slice(0, 10),
      gerador: 'scripts/gerar-nomes.mjs',
      fonteBrasil: 'IBGE Censo Demografico 2022 (divulgado 04/11/2025), via Wikipedia pt',
      fonteDemais: 'scripts/nomes-regionais.mjs (autoral, nomes comuns por regiao)',
      observacao: 'Somente masculino. O jogo nao trata a categoria feminina.',
    },
    pools,
  };

  const destino = new URL('../js/data/nomes-jogadores.json', import.meta.url);
  if (process.argv.includes('--dry-run')) {
    console.log(`\n(dry-run; ${Object.keys(saida.pools).length} pool(s) pronto(s) para ${destino.pathname})`);
    return;
  }
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(new URL('../js/data/', import.meta.url), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(saida, null, 2)}\n`, 'utf8');
  console.log(`\nescrito: ${destino.pathname}`);
}

main().catch(erro => {
  console.error(erro);
  process.exit(1);
});
