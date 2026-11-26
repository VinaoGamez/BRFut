import assert from 'node:assert/strict';
import { abbreviatePlayerName, abbreviateRosterNames, playerDisplayName } from '../js/engine/player-display-names.js';
import { nicknameForName, CURATED_NICKNAMES } from '../js/engine/player-nicknames.js';
import { rollPlayerName, variantPlayerName } from '../js/engine/player-names.js';
import { createPlayerCells } from '../js/feature/shared/player-cells.js';

let passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`OK ${label}`); };
check('particles disappear in display only', () => {
  assert.equal(abbreviatePlayerName('José Antônio Ferreira de Oliveira'), 'José A. F. Oliveira');
  for (const particle of ['de', 'da', 'do', 'das', 'dos', 'e', 'y', 'del', 'la', 'van', 'der', 'di']) {
    assert.equal(abbreviatePlayerName(`João ${particle} Souza Lima`), 'João S. Lima');
  }
  assert.equal(abbreviatePlayerName('Carlos da Costa'), 'Carlos Costa');
  assert.equal(abbreviatePlayerName('Kaká'), 'Kaká');
});
check('collisions include full names rendered later', () => {
  const names = ['João Souza Silva', 'João Santos Silva', 'João S. Silva', 'J. Santos Silva'];
  for (const input of [names, [...names].reverse()]) {
    const labels = abbreviateRosterNames(input);
    assert.equal(new Set(labels).size, names.length);
    assert.equal(labels[input.indexOf('João S. Silva')], 'João S. Silva');
  }
});
check('roster lookup is pure and unknown context keeps full name', () => {
  const roster = [{ name: 'José Antônio de Oliveira', playerId: 'one' }];
  const before = JSON.stringify(roster);
  assert.equal(playerDisplayName(roster[0].name, roster), 'José A. Oliveira');
  assert.equal(JSON.stringify(roster), before);
  assert.equal(playerDisplayName(roster[0].name), roster[0].name);
  roster[0].name = 'João Souza Silva';
  roster.push({ name: 'João S. Silva' });
  assert.notEqual(playerDisplayName(roster[0].name, roster), roster[1].name);
});
check('generated rosters remain unambiguous and labels never grow', () => {
  let state = 42;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  for (let seed = 0; seed < 100; seed++) {
    const names = [...new Set(Array.from({ length: 35 }, (_, index) => rollPlayerName({ index, random })))];
    const labels = abbreviateRosterNames(names);
    const key = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // Exact/full homonyms are a separate identity issue, not abbreviation.
    if (new Set(names.map(key)).size !== names.length) continue;
    assert.equal(new Set(labels.map(key)).size, labels.length);
    labels.forEach((label, index) => assert.ok(label.length <= names[index].length));
  }
});
check('real UI cell displays abbreviation with full-name tooltip and ID', () => {
  const roster = [{ name: 'José Antônio de Oliveira', playerId: 'test-player' }];
  const { playerNameCell } = createPlayerCells({ getPlayerRoster: () => roster });
  const html = playerNameCell(roster[0].name, roster[0], { openCard: true });
  assert.ok(html.includes('>José A. Oliveira</span>'));
  assert.ok(html.includes('title="José Antônio de Oliveira"'));
  assert.ok(html.includes('data-player-id="test-player"'));
  assert.equal(roster[0].name, 'José Antônio de Oliveira');
});
check('derived nicknames relate to the name; unknown names stay full', () => {
  assert.equal(nicknameForName('Ronaldo', () => 0.01), 'Ronaldinho');
  assert.equal(nicknameForName('Paulo', () => 0.01), 'Paulinho');
  assert.equal(nicknameForName('João', () => 0.01), 'Joãozinho');
  assert.equal(nicknameForName('Unknown', () => 0.01), '');
  assert.equal(nicknameForName('Ronaldo', () => 0.5), '');
  assert.equal(CURATED_NICKNAMES.length, 40);
  assert.equal(new Set(CURATED_NICKNAMES).size, 40);
});
check('generator applies nickname path only to Brazil', () => {
  assert.equal(rollPlayerName({ nationality: 'Brasil', random: () => 0 }), CURATED_NICKNAMES[0]);
  for (const nationality of ['Argentina', 'Japão', 'Nigéria']) {
    assert.ok(!CURATED_NICKNAMES.includes(rollPlayerName({ nationality, random: () => 0 })));
  }
});
check('dedupe variants cannot stack inherited suffixes', () => {
  for (const name of ['João Silva Júnior', 'João Filho', 'João Neto', 'João Junior']) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const variant = variantPlayerName(name, { attempt, random: () => 0.4 });
      assert.ok(variant.split(' ').filter(p => /^(j[uú]nior|filho|neto)$/i.test(p)).length <= 1, variant);
    }
  }
});
console.log(`player-name-display: ${passed} passed, 0 failed`);
