/**
 * Nomes de jogadores — deduplicação sem sufixo numérico.
 * Uso: node scripts/player-names-tests.mjs
 */
import assert from 'node:assert/strict';
import {
  dedupeRosterNames,
  hasTrailingNumericNameSuffix,
  stripTrailingNumericNameSuffix,
  variantPlayerName,
} from '../js/engine/player-names.js';

let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

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
