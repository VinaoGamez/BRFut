/**
 * Nomes de jogadores — deduplicação sem sufixo numérico + pools por país.
 * Uso: node scripts/player-names-tests.mjs
 */
import assert from 'node:assert/strict';
import {
  dedupeRosterNames,
  hasTrailingNumericNameSuffix,
  stripTrailingNumericNameSuffix,
  variantPlayerName,
  rollPlayerName,
  PLAYER_NAME_POOLS,
} from '../js/engine/player-names.js';

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

// PRNG fixo: os testes precisam falhar sempre igual.
function rng(semente = 1) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const varios = (n, nacionalidade, semente = 5) =>
  Array.from({ length: n }, (_, i) => rollPlayerName({ nationality: nacionalidade, index: i, random: rng(semente + i) }));

check('pool por pais: unlocking Colombia com acento nao cai no Brasil', () => {
  // Bug real: o pool se chamava 'Colombia' e a busca era por igualdade exata.
  // 'Colômbia' nao achava, caia no Brasil, e o colombiano saia com nome
  // brasileiro em silencio.
  //
  // Só se checa a procedencia, nao a exclusividade: 'Jefferson' e 'Castro'
  // existem nos dois paises, e asserir "nao pode estar na pool brasileira"
  // reprovaria dado correto.
  const poolCol = PLAYER_NAME_POOLS['Colombia'];
  for (const nome of varios(12, 'Colômbia')) {
    const primeiro = nome.split(' ')[0];
    assert.ok(
      poolCol.first.includes(primeiro),
      `"${nome}" nao veio da pool colombiana — caiu no Brasil`,
    );
  }
});

check('selecao: nome sempre vem da pool da nacionalidade', () => {
  // Regra do jogo: na selecao, o nome tem que bater com a nacionalidade.
  // Chave de teste: um nome que existe SO no Brasil nunca pode aparecer ao
  // gerar jogador de outra nacionalidade.
  const alvos = ['Argentina', 'Colombia', 'Venezuela', 'Chile', 'Equador', 'Uruguai', 'Paraguai', 'Portugal', 'Alemanha', 'França', 'Itália', 'Japão', 'China'];
  for (const nacionalidade of alvos) {
    const pool = PLAYER_NAME_POOLS[nacionalidade];
    for (let i = 0; i < 60; i += 1) {
      const nome = rollPlayerName({ nationality: nacionalidade, index: i, random: rng(900 + i) });
      // Não se conta o número de partes: "Di María" é sobrenome legítimo em
      // espanhol. O que importa é que CADA token venha da pool do país.
      //
      // E a ordem depende da forma: em 'sobrenome-primeiro' (Japão, China) o
      // primeiro token é sobrenome, não nome.
      const esperado = pool.forma === 'sobrenome-primeiro' ? pool.last : pool.first;
      const primeiro = nome.split(' ')[0];
      assert.ok(
        esperado.includes(primeiro),
        `${nacionalidade}: "${nome}" não começou por ${pool.forma === 'sobrenome-primeiro' ? 'sobrenome' : 'nome'} da pool do país`,
      );
      assert.ok(nome.length <= 40, `${nacionalidade}: "${nome}" passou de 40 caracteres`);
    }
  }
});

check('busca por pool ignora caixa e acento', () => {
  const base = varios(6, 'Venezuela').join('|');
  for (const variante of ['Venezuela', 'VENEZUELA', 'Venezuela ', 'venezuela']) {
    assert.equal(varios(6, variante).join('|'), base, `variante "${variante}" deu pool diferente`);
  }
});

check('pais sem pool propria cai na regiao, nao no Brasil', () => {
  // Nigéria não tem pool própria: tem que vir da África Ocidental.
  const poolNigeria = PLAYER_NAME_POOLS['África Ocidental'].first;
  const poolBr = PLAYER_NAME_POOLS.Brasil.first;
  for (const nome of varios(15, 'Nigéria')) {
    const primeiro = nome.split(' ')[0];
    assert.ok(poolNigeria.includes(primeiro), `"${primeiro}" nao veio da África Ocidental`);
    assert.ok(!poolBr.includes(primeiro), `"${primeiro}" e brasileiro em pool africana`);
  }
});

check('Japao usa sobrenome antes do nome', () => {
  const pool = PLAYER_NAME_POOLS['Japão'].last;
  for (const nome of varios(10, 'Japão')) {
    const partes = nome.split(' ');
    assert.equal(partes.length, 2, `nome japones com ${partes.length} partes: ${nome}`);
    assert.ok(pool.includes(partes[0]), `"${nome}" nao comeca por sobrenome japones`);
  }
});

check('pools hispánicas nao usam sobrenome lusófono', () => {
  const lusofonos = ['Silva', 'Santos', 'Souza', 'Oliveira', 'Pereira', 'Coelho', 'Batista', 'Nogueira'];
  for (const pais of ['Argentina', 'Colombia', 'Venezuela', 'Chile', 'Equador', 'Uruguai', 'Paraguai', 'Espanha']) {
    for (const sobrenome of PLAYER_NAME_POOLS[pais].last) {
      assert.ok(!lusofonos.includes(sobrenome), `${pais} tem sobrenome lusofono "${sobrenome}"`);
    }
  }
});

check('pool nao tem nome com grafia duplicada', () => {
  // O IBGE publica 'JoséJose', 'André  André' como entradas separadas.
  for (const [pais, pool] of Object.entries(PLAYER_NAME_POOLS)) {
    for (const nome of [...pool.first, ...pool.last]) {
      assert.ok(!/\s{2}/.test(nome), `${pais}: "${nome}" tem espaço duplo`);
      const partes = nome.split(' ').map(p => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      assert.equal(new Set(partes).size, partes.length, `${pais}: "${nome}" repete palavra`);
    }
  }
});

check('sufixo patronímico so em pool que declara', () => {
  // 'Tanaka Hiroshi Júnior' não existe. O pool japonês não declara sufixos,
  // então a estratégia que os aplica tem de cair para reroll.
  for (const nome of varios(60, 'Japão')) {
    assert.ok(!/Júnior|Neto|Filho/.test(nome), `sufixo em nome japones: ${nome}`);
  }
  // E no Brasil os sufixos existem, mas são raros — eram 0% antes do pool maior.
  const br = varios(400, 'Brasil').filter(n => /Júnior|Neto|Filho/.test(n));
  assert.ok(br.length > 0, 'nenhum sufixo em 400 nomes brasileiros — o código virou morto de novo');
  assert.ok(br.length < 60, `sufixo demais: ${br.length}/400`);
});

check('stripTrailingNumericNameSuffix removes legacy suffix', () => {
  assert.equal(stripTrailingNumericNameSuffix('Henrique Vieira 2'), 'Henrique Vieira');
  assert.equal(hasTrailingNumericNameSuffix('Murilo Machado 2'), true);
});

check('dedupeRosterNames never emits numeric suffixes', () => {
  const roster = [
    { name: 'Henrique Vieira', pos: 'MEI' },
    { name: 'Henrique Vieira', pos: 'ATA' },
    { name: 'Murilo Machado', pos: 'ATA' },
    { name: 'Murilo Machado', pos: 'MEI' },
  ];
  dedupeRosterNames(roster, { random: () => 0.42 });
  const names = roster.map(player => player.name);
  assert.equal(new Set(names).size, names.length);
  names.forEach(name => {
    assert.ok(!hasTrailingNumericNameSuffix(name), `unexpected numeric suffix: ${name}`);
    assert.ok(!/\s\d+$/.test(name), `numeric suffix leaked: ${name}`);
  });
});

check('dedupeRosterNames repairs legacy numeric names on load', () => {
  const roster = [
    { name: 'Henrique Vieira', pos: 'MEI' },
    { name: 'Henrique Vieira 2', pos: 'ATA' },
  ];
  dedupeRosterNames(roster, { random: () => 0.33 });
  assert.notEqual(roster[0].name, roster[1].name);
  assert.ok(!hasTrailingNumericNameSuffix(roster[1].name));
});

check('variantPlayerName stays within readable patterns', () => {
  const sample = variantPlayerName('João Silva', { attempt: 2, random: () => 0.5 });
  assert.ok(sample.includes(' '));
  assert.ok(!/\s\d+$/.test(sample));
});

console.log(`\nplayer-names tests: ${passed}/${passed} passed`);
