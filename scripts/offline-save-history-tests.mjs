import assert from 'node:assert/strict';
import { SAVE_KEYS, SAVE_VERSION, SAVE_RESET_EPOCH, SAVE_RESET_MARKER_KEY, CAREER_INDEX_KEY, ACTIVE_SLOT_SESSION_KEY, slotBundleKeys } from '../js/core/constants.js';
import { recoverMislabeledCareerVersions, canRecoverMislabeledCareer, careerRecoveryAliases } from '../js/core/career-version-recovery.js';
import { createPlayerHistoryEngine, restorePlayerHistoryMatches, resolvePlayerSeasonStats } from '../js/engine/player-history.js';
import { rosterPlayerToCardPlayer } from '../js/feature/player-card/roster-card-player.js';
import { persistSeasonPayload } from '../js/engine/season-save-quota.js';
import { setCloudLocalTrimEnabled } from '../js/core/local-save-checkpoint.js';
import { readCareerIndex, syncActiveSlotFromCache, cancelPendingSlotSync, hydrateSlot } from '../js/core/career-slot-manager.js';
import { createCareerPersistence } from '../js/engine/career-persistence.js';
import { writeJson, invalidateStoragePressureCache } from '../js/core/save.js';
import { prefetchStateLeagueSnapshot, consumePrefetchedStateLeagueSnapshot } from '../js/core/state-league-sync.js';

const data = new Map(), session = new Map();
let rejectKey = null;
const storage = map => ({ getItem: k => map.get(k) ?? null, setItem: (k,v) => {
  if (k === rejectKey) throw new DOMException('Full', 'QuotaExceededError');
  map.set(k,String(v));
}, removeItem: k => map.delete(k), key: i => [...map.keys()][i] ?? null, get length() { return map.size; } });
globalThis.localStorage = storage(data);
globalThis.sessionStorage = storage(session);
globalThis.window = { location: { origin:'app://brfut', protocol:'app:', hostname:'brfut' }, addEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout };
globalThis.fetch = async () => new Response('', { status:404 });
globalThis.CustomEvent = class { constructor(type, init) { this.type=type; this.detail=init?.detail; } };
const put = (k,v) => data.set(k,JSON.stringify(v));
const reset = () => { cancelPendingSlotSync(); data.clear(); session.clear(); rejectKey=null; invalidateStoragePressureCache(); };
let passed=0;
async function check(name, fn) { reset(); await fn(); passed++; console.log(`OK ${name}`); }
function fixtures() {
  const teams=Array.from({length:20},(_,i)=>`Club ${i}`), rounds=[];
  for(let r=0;r<19;r++) { rounds.push(Array.from({length:10},(_,i)=>({home:teams[i],away:teams[19-i]}))); teams.splice(1,0,teams.pop()); }
  return rounds;
}
const career = { version:7, seed:456, clubName:'Clube teste', division:'D', season:2026, createdAt:'2026-10-17T10:00:00Z' };
const season = { seed:456, careerSeason:2026, currentRound:1, nationalFixtures:{C:fixtures()} };
const match = { fixtureId:'fixture-1', season:2026, competitionId:'ESTADUAL:MT', homeClub:'Clube teste',awayClub:'Rival',homeGoals:1,awayGoals:0,
  players:[{playerId:'p-1',name:'Jogador teste',clubId:'Clube teste',started:true,minutes:90,goals:1,assists:0,rating:7.5}] };

await check('recover mislabeled v7, orphan slots and aliases without deleting original bundles',()=>{
  data.set(SAVE_RESET_MARKER_KEY,SAVE_RESET_EPOCH);
  for(const id of ['original','duplicate']) { put(slotBundleKeys(id).career,career); put(slotBundleKeys(id).season,season); }
  put(SAVE_KEYS.career,career); put(SAVE_KEYS.season,season);
  put(CAREER_INDEX_KEY,{version:2,saveEpoch:SAVE_RESET_EPOCH,activeSlotId:'duplicate',slots:[{id:'duplicate'}]});
  assert.equal(readCareerIndex().slots.length,0);
  assert.equal(recoverMislabeledCareerVersions().upgraded,3);
  assert.equal(readCareerIndex().slots.length,1);
  assert.deepEqual(careerRecoveryAliases('duplicate').sort(),['duplicate','original']);
  assert.ok(data.has(slotBundleKeys('original').career));
  assert.deepEqual(recoverMislabeledCareerVersions(),{upgraded:0,recovered:0});
});
await check('old double round robin and foreign season are never relabeled',()=>{
  assert.equal(canRecoverMislabeledCareer(career,{...season,nationalFixtures:{C:[...fixtures(),...fixtures()]}},SAVE_RESET_EPOCH),false);
  assert.equal(canRecoverMislabeledCareer(career,{...season,seed:999},SAVE_RESET_EPOCH),false);
  assert.equal(canRecoverMislabeledCareer(career,season,'old-epoch'),false);
});
await check('exact match ledger restores card statistics once across reloads and seasons',async()=>{
  const engine=createPlayerHistoryEngine();
  assert.equal(restorePlayerHistoryMatches(engine.getStore(),[match,match]),1);
  assert.equal(engine.persist(),true);
  const loaded=createPlayerHistoryEngine();
  assert.equal(restorePlayerHistoryMatches(loaded.getStore(),[match]),0);
  const card=await rosterPlayerToCardPlayer({playerId:'p-1',name:'Jogador teste',pos:'ATA'}, {playerHistory:loaded,careerSeason:2026,clubName:'Clube teste'});
  assert.equal(card.cardStats.clubApps,1); assert.equal(card.cardStats.goals,1); assert.equal(card.cardStats.avgRating,7.5);
  loaded.finalizeSeason(2026);
  assert.equal(resolvePlayerSeasonStats(createPlayerHistoryEngine(),'p-1',2026,null,{clubId:'Clube teste'}).goals,1);
});
await check('season compaction never deletes history, offline or online',()=>{
  for(const cloud of [false,true]) {
    setCloudLocalTrimEnabled(cloud);
    const engine=createPlayerHistoryEngine();restorePlayerHistoryMatches(engine.getStore(),[match]);assert.ok(engine.persist());
    const history=data.get(SAVE_KEYS.playerHistory);
    put('pressure-test','x'.repeat(2_300_000));invalidateStoragePressureCache();
    assert.equal(persistSeasonPayload({...season,careerMessages:[]}).ok,true);
    assert.equal(data.get(SAVE_KEYS.playerHistory),history);
  }
  setCloudLocalTrimEnabled(false);
});
await check('manual save fails honestly when history, bundle or index cannot be written',async()=>{
  session.set(ACTIVE_SLOT_SESSION_KEY,'slot');
  const c={...career,version:SAVE_VERSION.career};
  put(SAVE_KEYS.career,c);put(SAVE_KEYS.season,season);
  const engine=createPlayerHistoryEngine();restorePlayerHistoryMatches(engine.getStore(),[match]);
  let historyOk=true;
  const p=createCareerPersistence({getSavedNewGame:()=>c,getClubs:()=>({'Clube teste':{roster:[{playerId:'p-1',name:'Jogador teste'}]}}),getUserClub:()=>c.clubName,collectWorldRosters:()=>({}),persistPlayerHistory:()=>historyOk&&engine.persist()});
  p.bindWriteSeasonSave(()=>writeJson(SAVE_KEYS.season,season));
  assert.equal((await p.manualSaveAll()).localOk,true);
  session.clear();assert.equal(readCareerIndex().slots.length,1);
  session.set(ACTIVE_SLOT_SESSION_KEY,'slot');
  for(const key of [slotBundleKeys('slot').season,CAREER_INDEX_KEY]) {
    rejectKey=key;assert.equal(syncActiveSlotFromCache(),false);assert.equal((await p.manualSaveAll()).localOk,false);
  }
  rejectKey=null;historyOk=false;assert.equal((await p.manualSaveAll()).historyLocalOk,false);
});
await check('switching careers never carries player statistics from the previous slot',()=>{
  session.set(ACTIVE_SLOT_SESSION_KEY,'first');
  put(SAVE_KEYS.career,{...career,version:SAVE_VERSION.career});put(SAVE_KEYS.season,season);
  put(SAVE_KEYS.playerHistory,{players:{old:{seasons:{2026:{apps:8}}}}});
  assert.equal(syncActiveSlotFromCache(),true);
  put(slotBundleKeys('second').career,{...career,version:SAVE_VERSION.career,seed:999});
  assert.equal(hydrateSlot('second'),true);
  assert.equal(data.has(SAVE_KEYS.playerHistory),false);
  assert.ok(data.has(slotBundleKeys('first').playerHistory));
});
await check('every career write preserves current roster IDs without overwriting a different club',()=>{
  const roster=[{playerId:'stable-id',name:'Jogador',age:22}];
  const p=createCareerPersistence({getClubs:()=>({'Clube teste':{roster}}),getUserClub:()=>career.clubName});
  assert.ok(p.persistCareer({...career,version:SAVE_VERSION.career}));
  assert.equal(JSON.parse(data.get(SAVE_KEYS.career)).userRoster[0].playerId,'stable-id');
  assert.ok(p.persistCareer({...career,clubName:'Outro',userRoster:[{playerId:'other'}]}));
  assert.equal(JSON.parse(data.get(SAVE_KEYS.career)).userRoster[0].playerId,'other');
});
await check('state league snapshot is restored from IndexedDB without login or network',async()=>{
  session.set(ACTIVE_SLOT_SESSION_KEY,'offline');
  const snapshot={seasonYear:2026,competitions:{MT:[{currentRound:8,fixtures:[[{home:'A',away:'B',completed:true}]]}]}};
  globalThis.indexedDB={open(){const open={};queueMicrotask(()=>{open.result={transaction:()=>({objectStore:()=>({get(id){assert.equal(id,'offline:2026');const req={};queueMicrotask(()=>{req.result={snapshot};req.onsuccess()});return req;}})})};open.onsuccess()});return open;}};
  const fetchBefore=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Offline restore must not contact a server')};
  assert.deepEqual(await prefetchStateLeagueSnapshot(2026),snapshot);
  assert.deepEqual(consumePrefetchedStateLeagueSnapshot(),snapshot);
  delete globalThis.indexedDB;globalThis.fetch=fetchBefore;
});
cancelPendingSlotSync();
console.log(`offline-save-history: ${passed} passed, 0 failed`);
process.exit(0);
