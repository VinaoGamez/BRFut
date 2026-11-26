import assert from 'node:assert/strict';
import { OVERALL_WEIGHTS, calculatePlayerOverall, syncPlayerOverall, ensurePlayerOverall, canDevelopAttribute } from '../js/engine/player-overall.js';
import { generatePlayer, generateSquad, DIVISION_OVR_LIMITS, applySetPieceSpecialists } from '../js/engine/player-generation.js';
import { applyOverallDelta, emptyDevelopmentState, runDevelopmentPulse, normalizeDevelopmentState, advancePlayerAges } from '../js/engine/player-development.js';
import { applyDevelopmentTrainingDay } from '../js/engine/training-development.js';
import { serializePlayerForWorld, hydratePlayer, stampWorldPlayers } from '../js/engine/world-rosters.js';
import { generateYouthPlayer, hydrateYouthPlayer } from '../js/engine/youth-academy.js';
import { abbreviateRosterNames } from '../js/engine/player-display-names.js';

const keys = ['speed','dribble','finishing','passing','marking','tackling','heading','playmaking','reflexes','positioning','penaltySaving','freeKick','penaltyTaking'];
const player = (pos = 'MC', value = 60) => ({ pos, name: 'Teste Silva', playerId: 'test', age: 21, fatigue: 100, potential: 80, ...Object.fromEntries(keys.map(k => [k, value])) });
let state = 42;
const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`OK ${name}`); };
check('weights normalized; old rating, division and condition cannot change capacity', () => {
  for (const [pos, weights] of Object.entries(OVERALL_WEIGHTS)) {
    assert.ok(Math.abs(Object.values(weights).reduce((a,b) => a+b, 0) - 1) < 1e-10);
    const p = player(pos), value = calculatePlayerOverall(p);
    assert.ok(Math.abs(value - 60) < 1e-10);
    assert.equal(calculatePlayerOverall({ ...p, overall: 99, fatigue: 1, potential: 1, division: 'D' }), value);
    for (const key of keys) assert.ok(calculatePlayerOverall({ ...p, [key]: 61 }) >= value - 1e-10);
  }
});
check('position-relevant stats count; single specialty cannot inflate whole player', () => {
  const p = player('ATA');
  assert.equal(calculatePlayerOverall({ ...p, reflexes: 90 }), calculatePlayerOverall(p));
  assert.ok(calculatePlayerOverall({ ...p, finishing: 80 }) > 66);
  assert.ok(Math.abs(calculatePlayerOverall({ ...p, penaltyTaking: 90 }) - 60.6) < 1e-8);
  assert.ok(Math.abs(calculatePlayerOverall({ ...player('MC'), playmaking: 80 }) - 63) < 1e-8);
});
check('recalculations cannot manufacture growth; regressions and fractional gains survive', () => {
  const p = player(); p.overall = 99;
  syncPlayerOverall(p); assert.equal(p.overall, 60);
  for (let i=0;i<100;i++) { syncPlayerOverall(p); assert.equal(p.overall, 60); }
  p.passing++; syncPlayerOverall(p);
  assert.ok(p.overallRaw > 60); assert.equal(p.overall, 60);
  p.passing = 40; syncPlayerOverall(p); assert.ok(p.overall < 60);
});
check('generation, specialties, names and all divisions agree with derived OVR', () => {
  let count = 0, specialists = 0;
  for (const division of ['A','B','C','D']) for(let i=0;i<50;i++) {
    const { roster } = generateSquad({ division, random });
    for (const p of roster) {
      count++;
      assert.equal(p.overall, Math.round(calculatePlayerOverall(p)));
      assert.ok(p.overall >= DIVISION_OVR_LIMITS[division][0] && p.overall <= DIVISION_OVR_LIMITS[division][1]);
      assert.ok(p.potential + 1e-8 >= p.overallRaw);
      assert.ok(p.name && !/JoséJose|\s\d+$/.test(p.name));
      assert.ok(p.name.split(' ').filter(k=>/^(j[uú]nior|filho|neto)$/i.test(k)).length <= 1);
      specialists += !!(p.setPieceSpecialist || p.penaltySavingSpecialist);
    }
    const names = roster.map(p=>p.name);
    if (new Set(names).size === names.length) assert.equal(new Set(abbreviateRosterNames(names)).size, names.length);
  }
  assert.ok(specialists > 0);
  console.log(`  ${count} generated players, ${specialists} specialists`);
});
check('specialty generation no longer depends on a stale overall', () => {
  const p = { ...player('ATA'), overall: 10 }, q = { ...p, overall: 99 };
  applySetPieceSpecialists(p, 'A', () => 0);
  applySetPieceSpecialists(q, 'A', () => 0);
  for (const key of keys) assert.equal(p[key], q[key]);
  assert.equal(p.setPieceSpecialist, 'both');
});
check('potential blocks attribute growth rather than hiding it in displayed OVR', () => {
  const p = player(); p.potential = 60;
  assert.equal(canDevelopAttribute(p, 'passing'), false);
  syncPlayerOverall(p);
  const before = keys.map(k=>p[k]);
  assert.equal(applyOverallDelta(p, 3), false);
  assert.deepEqual(keys.map(k=>p[k]), before);
  const s = emptyDevelopmentState(2026);
  for (let day=0;day<100;day++) {
    p.fatigue = 100;
    applyDevelopmentTrainingDay({roster:[p],state:s,focus:'passing',getPlayerId:p=>p.playerId});
  }
  assert.deepEqual(keys.map(k=>p[k]), before);
});
check('training caps and progress survive serialization; capacity stays coherent', () => {
  const p = player(), s = emptyDevelopmentState(2026); syncPlayerOverall(p);
  for (let day=0;day<400;day++) {
    p.fatigue = 100;
    applyDevelopmentTrainingDay({roster:[p],state:s,focus:'passing',getPlayerId:p=>p.playerId});
    assert.equal(p.overall, Math.round(calculatePlayerOverall(p)));
    assert.ok(p.overallRaw <= 62 + 1e-8);
  }
  assert.ok(p.passing > 60);
  const loaded = normalizeDevelopmentState(JSON.parse(JSON.stringify(s)), 2026);
  assert.equal(loaded.trainingByPlayer.test.startOverallRaw, s.trainingByPlayer.test.startOverallRaw);
});
check('career pulses move attributes, respect potential and reconcile OVR', () => {
  const p = player(); syncPlayerOverall(p);
  assert.ok(applyOverallDelta(p, 2)); assert.equal(p.overall, 62);
  assert.ok(applyOverallDelta(p, -1)); assert.ok(p.overall <= 62);
  assert.equal(p.overall, Math.round(calculatePlayerOverall(p)));
  assert.equal(p.potential, 80);
  const result = runDevelopmentPulse({clubs:{X:{roster:[p]}},state:emptyDevelopmentState(2026),season:2026,pulseId:'mid',getSeasonBucket:()=>({minutes:800,starts:10,ratingSum:80,ratingCount:10})});
  assert.ok(!result.skipped); assert.equal(p.overall, Math.round(calculatePlayerOverall(p)));
});
check('legacy reconciliation and world roundtrip preserve attributes, identity and names', () => {
  const p = { ...player(), overall: 85, potential: 85 };
  const attrs = keys.map(k=>p[k]); ensurePlayerOverall(p);
  assert.equal(p.overall, 60); assert.deepEqual(keys.map(k=>p[k]), attrs);
  const snapshot = serializePlayerForWorld(p), q = hydratePlayer(snapshot, {division:'A'});
  assert.equal(q.playerId, p.playerId); assert.equal(q.name,p.name);
  assert.equal(q.overallRaw,p.overallRaw);
  const clubs = {X:{division:'A',roster:[q]}};
  stampWorldPlayers(clubs); const once = JSON.stringify(q); stampWorldPlayers(clubs);
  assert.equal(JSON.stringify(q), once);
});
check('academy uses the same generator and migration', () => {
  const p = generateYouthPlayer({club:{power:58},clubName:'Teste',division:'A',random});
  assert.equal(p.overall, Math.round(calculatePlayerOverall(p)));
  const q = hydrateYouthPlayer({...p,overall:99});
  assert.equal(q.overall, p.overall); assert.equal(q.name,p.name);
});
check('25-season career: attributes, OVR and fixed potential stay consistent', () => {
  const roster = Object.keys(OVERALL_WEIGHTS).map((role,index) => {
    const p = generatePlayer({role,clubPower:57,division:'A',random,index});
    p.age = 17; p.playerId = `career-${index}`; p.potential = Math.max(p.potential,80);
    return p;
  });
  const pots = roster.map(p=>p.potential), clubs = {X:{roster}};
  let rises=0,falls=0;
  for(let year=0;year<25;year++) {
    const development=emptyDevelopmentState(2026+year);
    for(let day=0;day<40;day++) {
      roster.forEach(p=>p.fatigue=100);
      applyDevelopmentTrainingDay({roster,state:development,focus:'individual',getPlayerId:p=>p.playerId});
    }
    for(let pulse=1;pulse<=4;pulse++) {
      const before=roster.map(p=>p.overall);
      runDevelopmentPulse({clubs,state:development,season:2026+year,pulseId:`pulse-${pulse}`,getSeasonBucket:()=>({minutes:800*pulse,starts:10*pulse,ratingSum:(year<15?80:50)*pulse,ratingCount:10*pulse})});
      roster.forEach((p,i)=>{rises+=p.overall>before[i];falls+=p.overall<before[i];});
    }
    for(const [i,p]of roster.entries()) {
      assert.equal(p.potential,pots[i]);
      assert.ok(calculatePlayerOverall(p)<=p.potential+1e-8);
      assert.equal(p.overall,Math.round(calculatePlayerOverall(p)));
      for(const key of keys)assert.ok(Number.isFinite(p[key])&&p[key]>=0&&p[key]<=99);
    }
    advancePlayerAges(clubs);
  }
  assert.ok(rises>0&&falls>0);
  console.log(`  9 careers x 25 seasons; ${rises} positive / ${falls} negative pulse changes`);
});
console.log(`player-overall: ${passed} passed, 0 failed`);
