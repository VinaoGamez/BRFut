import assert from 'node:assert/strict';
import { conditionalGoalChanceFromXg } from '../js/engine/match-tuning.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

check('xG total vira chance condicional ao chute no alvo', () => {
  const xg = 0.133;
  const onTarget = 0.37;
  const conditional = conditionalGoalChanceFromXg(xg, onTarget);
  assert.ok(Math.abs(conditional - xg / onTarget) < 1e-12);
  assert.ok(Math.abs(onTarget * conditional - xg) < 1e-12);
});

check('conversão respeita os limites do motor', () => {
  assert.equal(conditionalGoalChanceFromXg(0.01, 0.9), 0.15);
  assert.equal(conditionalGoalChanceFromXg(0.9, 0.1), 0.55);
});

check('Monte Carlo preserva o xG combinado', () => {
  let state = 0x51f15e;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const samples = 200_000;
  const xg = 0.18;
  const onTarget = 0.45;
  const conditional = conditionalGoalChanceFromXg(xg, onTarget);
  let goals = 0;
  for (let i = 0; i < samples; i++) {
    if (random() < onTarget && random() < conditional) goals++;
  }
  assert.ok(Math.abs(goals / samples - xg) < 0.005, `${goals / samples} fora do xG ${xg}`);
});

console.log(`\nmatch-conversion-tests: ${passed} passed`);
