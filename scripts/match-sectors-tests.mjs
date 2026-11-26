import assert from 'node:assert/strict';
import { sectorAverage, sectorParticipation, SECTOR_WEIGHTS } from '../js/engine/match-sectors.js';
import { createMatchRatingsEngine, blankMatchStats } from '../js/engine/match-ratings.js';
import { createLiveMatchActions } from '../js/engine/match-live.js';
import { createRoundMatchSimulator } from '../js/engine/match-sim.js';
import { ENGINE_TUNING, engineFoulRisk, engineScoreDamp, fatigueMinuteWear } from '../js/engine/match-tuning.js';
import { FORMATION_PERFORMANCE, COMPATIBLE_ROLES } from '../js/engine/match-core.js';

const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const attrs = ['speed','dribble','finishing','passing','marking','tackling','heading','playmaking','penaltyTaking','freeKick','reflexes','positioning','penaltySaving'];
const stats60 = () => Object.fromEntries(attrs.map(key=>[key,60]));
const stat = (p,key) => p?.[key] ?? 50;
const roles = ['GOL','LAT','ZAG','ZAG','LAT','VOL','MC','MC','PE','PD','ATA'];
const roles4231 = ['GOL','LAT','ZAG','ZAG','LAT','VOL','VOL','PE','MEI','PD','ATA'];
const tactical = {formation:'4-4-2',mentality:50,possession:50,press:50,offsideLine:50};
const context = () => ({overall:0,attack:0,passing:0,defense:0,keeper:0,discipline:0,wear:1,recovery:1,volatility:0});
const team = (name, positions=roles) => ({name,position:10,power:60,formation:'4-4-2',mentality:'Equilibrada',style:'Equilibrada',_benchmarkTactic:{...tactical},roster:positions.map((pos,i)=>({name:`${name}-${i}`,pos,age:26,fatigue:100,overall:60,...stats60()}))});
let seed=1;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let passed=0;
const check=(label,fn)=>{fn();passed++;console.log(`OK ${label}`);};

check('weighted means preserve scale, global OVR and fatigue; empty sectors stay finite',()=>{
  const roster=team('X').roster;
  for(const sector of Object.keys(SECTOR_WEIGHTS))assert.ok(Math.abs(sectorAverage(roster,'passing',sector,stat)-60)<1e-10);
  assert.equal(sectorAverage([],'finishing'),0);
  assert.equal(sectorAverage([roster[0]],'finishing'),0);
  assert.ok(Math.abs(sectorAverage(roster,'overall')-60)<1e-10);
  assert.equal(sectorAverage(roster,'fatigue'),100);
  assert.ok(Math.abs(sectorAverage(roster,'finishing','attack',stat,()=>.5)-30)<1e-10);
});
check('keepers do not raise collective attack with finishing; distribution still counts',()=>{
  const roster=team('X').roster;
  const attack=sectorAverage(roster,'finishing','attack',stat),passing=sectorAverage(roster,'passing','passing',stat);
  roster[0].finishing=99;roster[0].passing=90;
  assert.equal(sectorAverage(roster,'finishing','attack',stat),attack);
  assert.ok(sectorAverage(roster,'passing','passing',stat)>passing);
});
check('same attribute investment has different sector contributions by position',()=>{
  const make=(positions,changes)=>{const roster=team('X').roster;for(const p of roster)if(positions.includes(p.pos))Object.assign(p,changes);return roster;};
  const forward=['ATA','PE','PD'],mid=['VOL','MC'],back=['ZAG','VOL'];
  const sum=(roster,key)=>roster.reduce((s,p)=>s+p[key],0);
  const a=make(forward,{finishing:80}),b=make(mid,{finishing:80});
  assert.equal(sum(a,'finishing'),sum(b,'finishing'));
  assert.ok(sectorAverage(a,'finishing','attack',stat)>sectorAverage(b,'finishing','attack',stat));
  assert.ok(sectorAverage(make(mid,{passing:80}),'passing','passing',stat)>sectorAverage(make(forward,{passing:80}),'passing','passing',stat));
  assert.ok(sectorAverage(make(back,{marking:80}),'marking','defense',stat)>sectorAverage(make(forward,{marking:80}),'marking','defense',stat));
  assert.ok(sectorParticipation({pos:'ATA'},'shot')>sectorParticipation({pos:'MC'},'shot'));
  assert.ok(sectorParticipation({pos:'MC'},'pass')>sectorParticipation({pos:'ATA'},'pass'));
  assert.equal(sectorParticipation({pos:'GOL'},'save'),1);
});

function liveFixture(){
  const home=team('HOME',roles4231),away=team('AWAY',roles4231);
  home.formation=away.formation='4-2-3-1';
  const cards={home:roles4231.map(()=>({})),away:roles4231.map(()=>({}))};
  let stats={home:blankMatchStats(),away:blankMatchStats()},goals={home:[],away:[]};
  const engine=createMatchRatingsEngine({clamp,matchPlayerStat:stat,clubInstitutionalContext:context,playerUnavailable:p=>!!p.unavailable,
    getTactics:()=>({getTacticalValues:()=>tactical}),getFormation:()=>home.formation,getStarters:()=>home.roster,
    getClubs:()=>({HOME:home,AWAY:away}),getUserClub:()=> 'HOME',getMatchClub:()=>away,getNextUserGame:()=>({home:'HOME',away:'AWAY'}),
    getMatchFactors:()=>({home:1,away:1}),getCards:()=>cards,getStats:()=>stats,getHomeScore:()=>goals.home.length,getAwayScore:()=>goals.away.length,
    getPositionAssignments:()=>roles4231,getTacticFor:()=>tactical});
  return {engine,home,away,cards,getStats:()=>stats,getGoals:()=>goals,reset:()=>{stats={home:blankMatchStats(),away:blankMatchStats()};goals={home:[],away:[]};}};
}
check('live profiles use the shared sector means for both clubs',()=>{
  const f=liveFixture(),home=f.engine.profile(),away=f.engine.opponentForMatch();
  f.home.roster[0].finishing=99;f.away.roster[0].finishing=99;
  assert.equal(f.engine.profile().attack,home.attack);
  assert.equal(f.engine.opponentForMatch().attack,away.attack);
  f.home.roster[8].playmaking=80;
  assert.ok(f.engine.profile().passing>home.passing);
});
check('MEI participates in live shots for both sides; unavailable/red/injured players do not',()=>{
  const f=liveFixture(),oldRandom=Math.random;
  const names={home:new Set(),away:new Set()};
  try{
    Math.random=random;seed=791;
    for(let i=0;i<5000;i++)for(const side of ['home','away'])names[side].add(f.engine.playerFor(side,'shot'));
    assert.ok(names.home.has('HOME-8'));assert.ok(names.away.has('AWAY-8'));
    assert.ok(!names.home.has('HOME-0'));
    f.cards.home[8].red=true;f.cards.home[7].injured=true;f.home.roster[9].unavailable=true;
    for(let i=0;i<1000;i++)assert.equal(f.engine.playerFor('home','shot'),'HOME-10');
  }finally{Math.random=oldRandom;}
});
check('real live builds: improving MEI finishing produces MEI goals, without extra shots',()=>{
  const run=finishing=>{
    const f=liveFixture();f.home.roster[8].finishing=finishing;
    const current=f.engine.profile(),other=f.engine.opponentForMatch();
    const {buildAttack}=createLiveMatchActions({clamp,random,rnd:(a,b)=>a+random()*(b-a),getStats:f.getStats,getGoals:f.getGoals,
      getMinute:()=>30,getUserClub:()=> 'HOME',getMatchClub:()=>f.away,getStarters:()=>f.home.roster,getCards:()=>f.cards,
      playerFor:f.engine.playerFor,actorData:f.engine.actorData,incrementScore:()=>{},updateScoreboard:()=>{},log:()=>{},influencePossession:()=>{},
      engineTuning:ENGINE_TUNING,engineScoreDamp,engineFoulRisk,engineProgressiveFoulRisk:()=>.26,tacticFor:()=>tactical,
      tryLiveEventInjury:()=>false,foul:()=>false,pickInjuryVictim:(_,a)=>a});
    let shots=0,goals=0,meiGoals=0;
    for(let i=0;i<20000;i++){
      seed=(31291+i*7919)>>>0;f.reset();buildAttack('home',current,other,.72);
      shots+=f.getStats().home.shots;goals+=f.getGoals().home.length;
      meiGoals+=f.getGoals().home.filter(g=>g.name==='HOME-8').length;
    }
    return {shots,goals,meiGoals};
  };
  const oldRandom=Math.random;
  try{
    Math.random=random;
    const base=run(60),better=run(80);
    assert.ok(base.meiGoals>0&&better.meiGoals>base.meiGoals);
    assert.ok(better.goals>base.goals);assert.equal(better.shots,base.shots);
    console.log(JSON.stringify({liveBuildsPerScenario:20000,base,better}));
  }finally{Math.random=oldRandom;}
});

let clubs;
const {simulateRoundMatch}=createRoundMatchSimulator({clamp,random,rnd:(a,b)=>a+random()*(b-a),getClubs:()=>clubs,
  getLeagueData:()=>[{club:'HOME',points:20,played:15},{club:'AWAY',points:20,played:15}],clubInstitutionalContext:context,
  buildSimLineup:c=>({lineup:c.roster,bench:[]}),substitutionPriority:()=>0,engineTuning:ENGINE_TUNING,engineFoulRisk,engineScoreDamp,
  formationPerformance:FORMATION_PERFORMANCE,compatibleRoles:COMPATIBLE_ROLES,matchPlayerStat:stat,
  playerRehabMaxMinutes:()=>null,resolvePhysicalIncident:()=>null,buildDeferredInjuryEntry:()=>null,calculatePlayThroughSubChance:()=>0,
  pickInjuryVictim:(_,a)=>a,directRedDismissalType:()=> 'directRed',injurySeverityLabel:()=>''});
check('real round simulator: goalkeeper finishing invariance and forward investment advantage',()=>{
  const run=kind=>{
    let wins=0;const outcomes=[];
    for(let i=0;i<2000;i++){
      const home=i%2===0;clubs={HOME:team('HOME'),AWAY:team('AWAY')};
      const own=clubs[home?'HOME':'AWAY'];
      for(const p of own.roster){
        if(kind==='keeper'&&p.pos==='GOL')p.finishing=80;
        if(kind==='forward'&&['ATA','PE','PD'].includes(p.pos))p.finishing=80;
        if(kind==='midfield'&&['VOL','MC'].includes(p.pos))p.finishing=80;
      }
      seed=(930517+Math.floor(i/2)*7919)>>>0;
      const m=simulateRoundMatch('HOME','AWAY'),a=home?'home':'away',b=home?'away':'home';
      wins+=m[`${a}Goals`]>m[`${b}Goals`];outcomes.push([m.homeGoals,m.awayGoals,m.data.homeXg,m.data.awayXg]);
    }
    return {win:wins/2000,outcomes};
  };
  const base=run('base'),keeper=run('keeper'),forward=run('forward'),midfield=run('midfield');
  assert.deepEqual(keeper.outcomes,base.outcomes);
  assert.ok(forward.win-midfield.win>.05);
  console.log(JSON.stringify({roundMatches:8000,base:base.win,forward:forward.win,midfield:midfield.win}));
});
check('formation bonuses and wear curve unchanged',()=>{
  assert.deepEqual(FORMATION_PERFORMANCE['4-3-3'],{attack:3,passing:1.5,defense:-1});
  assert.deepEqual(FORMATION_PERFORMANCE['5-3-2'],{attack:-1.8,passing:-.6,defense:4.5});
  assert.equal(fatigueMinuteWear({age:26}),.28);
  assert.equal(fatigueMinuteWear({age:34}),.38);
});
console.log(`match-sectors: ${passed} passed, 0 failed`);
