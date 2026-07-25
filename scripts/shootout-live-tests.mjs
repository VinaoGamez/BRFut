/**
 * Disputa ao vivo — decideShootoutWinner com estado dessincronizado.
 * Uso: node scripts/shootout-live-tests.mjs
 */
import assert from 'node:assert/strict';
import { decideShootoutWinner } from '../js/engine/shootout-takers.js';

// Morte súbita normal: empate nas cobranças, gols diferentes
{
  const out = decideShootoutWinner({
    clubs: ['Curitiba', 'Amazônia'],
    results: {
      Curitiba: [true, true, true, false, false, true],
      Amazônia: [true, false, true, false, true, false],
    },
    suddenDeath: true,
  });
  assert.equal(out.winner, 'Curitiba');
}

// Estado dessincronizado (5×8 cobranças, 3×6 gols) — encerra em favor do líder
{
  const out = decideShootoutWinner({
    clubs: ['Curitiba', 'Amazônia'],
    results: {
      Curitiba: [true, true, true, false, false],
      Amazônia: [true, false, true, false, true, true, true, true],
    },
    suddenDeath: true,
  });
  assert.equal(out.winner, 'Amazônia');
}

// Morte súbita empatada — sem vencedor até próxima cobrança
{
  const out = decideShootoutWinner({
    clubs: ['A', 'B'],
    results: {
      A: [true, true, true, false, false, true],
      B: [true, false, true, false, true, true],
    },
    suddenDeath: true,
  });
  assert.equal(out.winner, null);
  assert.equal(out.suddenDeath, true);
}

console.log('ok  shootout-live-tests (3 asserts)');
