import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRoundMatchSimulator } from '../js/engine/match-sim.js';
import { createLiveMatchActions } from '../js/engine/match-live.js';
import { ENGINE_TUNING, engineFoulRisk, overallControlContribution, engineScoreDamp } from '../js/engine/match-tuning.js';
import { FORMATION_PERFORMANCE, COMPATIBLE_ROLES } from '../js/engine/match-core.js';
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
let seed = 1;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const attrs = ['speed','dribble','finishing','passing','marking','tackling','heading','playmaking','penaltyTaking','freeKick','reflexes','positioning','penaltySaving'];
const pos = ['GOL','LAT','ZAG','ZAG','LAT','VOL','MC','MC','PE','PD','ATA'];
const skills = value => Object.fromEntries(attrs.map(k=>[k,value]));
const team = (name,ovr=60,skill=60) => ({name,position:10,power:60,_benchmarkTactic:{formation:'4-4-2',mentality:50,possession:50,press:50,offsideLine:50},roster:pos.map((pos,i)=>({name:name+i,pos,age:26,fatigue:100,overall:ovr,...skills(skill)}))});
const no = () => null;
let passed=0;
const check = (name,fn) => {fn();passed++;console.log(`OK ${name}`);};
check('collective OVR hint is bounded, symmetric and shared',()=>{
  assert.equal(overallControlContribution(80,60),1.5);
  assert.equal(overallControlContribution(99,1),1.5);
  assert.equal(overallControlContribution(60,80),-1.5);
  assert.equal(overallControlContribution(60,60),0);
  assert.ok(engineScoreDamp(3)<1);
});
let clubs;
const {simulateRoundMatch}=createRoundMatchSimulator({
  clamp,random,rnd:(a,b)=>a+random()*(b-a),getClubs:()=>clubs,
  getLeagueData:()=>[{club:'HOME',points:20,played:15},{club:'AWAY',points:20,played:15}],
  clubInstitutionalContext:()=>({overall:0,attack:0,passing:0,defense:0,keeper:0,discipline:0,wear:1,recovery:1,volatility:0}),
  buildSimLineup:c=>({lineup:c.roster,bench:[]}),substitutionPriority:()=>0,
  engineTuning:ENGINE_TUNING,engineFoulRisk,
  engineBlowoutDamp:()=>{throw new Error('OVR-dependent blowout damping must not run');},
  formationPerformance:FORMATION_PERFORMANCE,compatibleRoles:COMPATIBLE_ROLES,
  matchPlayerStat:(p,k)=>p?.[k]??50,playerRehabMaxMinutes:no,resolvePhysicalIncident:no,
  buildDeferredInjuryEntry:no,calculatePlayThroughSubChance:()=>0,pickInjuryVictim:(_,a)=>a,directRedDismissalType:()=> 'directRed',injurySeverityLabel:()=>'',
});
const rounds=(ovr,skill)=>{
  const n=2000;let win=0,draw=0,poss=0,gf=0,ga=0;
  for(let i=0;i<n;i++){
    const home=i%2===0;
    clubs={HOME:team('HOME',home?ovr:60,home?skill:60),AWAY:team('AWAY',home?60:ovr,home?60:skill)};
    seed=(764321+Math.floor(i/2)*7919)>>>0;
    const m=simulateRoundMatch('HOME','AWAY'),a=home?'home':'away',b=home?'away':'home';
    const ag=m[`${a}Goals`],bg=m[`${b}Goals`];
    win+=ag>bg;draw+=ag===bg;poss+=m.data[`${a}Possession`];gf+=ag;ga+=bg;
  }
  return {win:win/n,draw:draw/n,poss:poss/n,gf:gf/n,ga:ga/n};
};
check('real simulator: attributes matter much more than changing only the OVR label',()=>{
  const base=rounds(60,60),ovr=rounds(80,60),skill=rounds(60,65);
  console.log(JSON.stringify({matches:6000,base,ovrOnly:ovr,attributesOnly:skill}));
  assert.ok(Math.abs(base.poss-50)<.01);
  assert.ok(ovr.poss>base.poss&&ovr.poss-base.poss<3);
  assert.ok(ovr.win-base.win>0&&ovr.win-base.win<.05);
  assert.ok(skill.win-base.win>.2);
});
function liveShots(ovr,finishing=60){
  seed=73;
  const blank=()=>({shots:0,off:0,on:0,saved:0,keeperSaves:0,attacks:0,goodAttacks:0,momentum:0});
  const stats={home:blank(),away:blank()},goals={home:[],away:[]};
  const player={name:'Atacante',pos:'ATA',...skills(60),finishing};
  const {shot}=createLiveMatchActions({
    clamp,random,rnd:(a,b)=>a+random()*(b-a),getStats:()=>stats,getGoals:()=>goals,getMinute:()=>30,
    getUserClub:()=> 'HOME',getMatchClub:()=>({name:'AWAY'}),playerFor:()=> 'Atacante',
    actorData:side=>side==='home'?player:skills(60),incrementScore:no,updateScoreboard:no,log:no,
    influencePossession:no,engineTuning:ENGINE_TUNING,tryLiveEventInjury:()=>false,
    engineBlowoutDamp:()=>{throw new Error('OVR-dependent damping must not run live');},
  });
  for(let i=0;i<10000;i++)shot('home',{overall:ovr,attack:60,passing:60,defense:60},{overall:60,attack:60,passing:60,defense:60});
  return {stats,goals:goals.home.length};
}
check('real live shots: changing only OVR has no direct finishing bonus',()=>{
  const base=liveShots(60),ovr=liveShots(99),skill=liveShots(60,80);
  assert.deepEqual(ovr,base);
  assert.ok(skill.goals>base.goals);
  console.log(JSON.stringify({liveShotsPerScenario:10000,baseGoals:base.goals,ovrOnlyGoals:ovr.goals,finishing80Goals:skill.goals}));
});
check('live orchestration uses same bounded OVR rule, with no opening OVR boosts',()=>{
  const source=readFileSync('js/engine/match-live-orchestration.js','utf8');
  assert.ok(source.includes('overallControlContribution(homeProfile.overall, awayProfile.overall)'));
  assert.ok(!source.includes('Math.abs(overallGap)'));
  assert.ok(!source.includes('(homeLive - homeBase.overall) *'));
});
console.log(`match-overall-model: ${passed} passed, 0 failed`);
