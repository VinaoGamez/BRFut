import {
  engineBlowoutDamp,
  engineDominanceModifiers,
} from '../js/engine/match-tuning.js';

let failed = 0;
const assert = (label, cond) => {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed++;
  } else console.log(`ok: ${label}`);
};

assert('blowout 0-0 tied → no damp', engineBlowoutDamp(10, 0) === 1);
assert('blowout small gap → no damp', engineBlowoutDamp(5, 2) === 1);
assert('blowout leading favorite → damp', engineBlowoutDamp(10, 1) < 1);
assert('blowout leading favorite → damp min', engineBlowoutDamp(10, 1) >= 0.35);

const idle = engineDominanceModifiers({ gap: 10, lead: 0, ownShots: 2, rivalShots: 2 });
assert('no siege → neutral', idle.creationBoost === 1 && idle.conversionBoost === 1);

const siege = engineDominanceModifiers({ gap: 10, lead: 0, ownShots: 11, rivalShots: 0, minute: 75 });
assert('siege → creation boost', siege.creationBoost > 1);
assert('siege → conversion boost', siege.conversionBoost > 1);
assert('siege capped', siege.conversionBoost <= 1.11);

process.exit(failed ? 1 : 0);
