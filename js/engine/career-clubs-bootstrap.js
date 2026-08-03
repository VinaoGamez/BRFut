import { clamp } from '../ui/dom.js';
import {
  generatePlayer as generatePlayerCore,
  buildSquadRoles,
  DIVISION_CLUB_POWER,
  pickStarterFlags,
  rollProfessionalSquadSize,
  sanitizeSetPieceForDivision,
} from './player-generation.js';
import { dedupeRosterNames } from './player-names.js';
import { getRealClub } from './brazilian-clubs-by-uf.js';
import {
  ensureCascadePyramidIntegrity,
  finalizeHostReplacementCascade,
  findClubDivision,
} from './career-club-replacement.js';
import { applyWorldRosters, collectWorldRosters, stampWorldPlayers } from './world-rosters.js';

const FORMATIONS_FOR_CLUBS = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '4-1-4-1', '5-3-2', '4-3-1-2', '3-4-3'];
const FIRST_NAMES = ['Adriano', 'André', 'Arthur', 'Breno', 'Bruno', 'Caio', 'Carlos', 'Cristian', 'Daniel', 'Davi', 'Diego', 'Douglas', 'Eduardo', 'Enzo', 'Erick', 'Fábio', 'Felipe', 'Fernando', 'Gabriel', 'Guilherme', 'Gustavo', 'Heitor', 'Henrique', 'Hugo', 'Igor', 'Ítalo', 'João', 'Kaique', 'Leandro', 'Leonardo', 'Lucas', 'Luiz', 'Marcelo', 'Marcos', 'Matheus', 'Miguel', 'Murilo', 'Nathan', 'Nicolas', 'Otávio', 'Paulo', 'Pedro', 'Rafael', 'Renan', 'Rodrigo', 'Samuel', 'Thiago', 'Vitor', 'Victor', 'Wesley'];
const LAST_NAMES = ['Almeida', 'Alves', 'Amaral', 'Andrade', 'Araújo', 'Barbosa', 'Batista', 'Cardoso', 'Carvalho', 'Castro', 'Correia', 'Costa', 'Cunha', 'Dias', 'Duarte', 'Esteves', 'Ferreira', 'Freitas', 'Garcia', 'Gomes', 'Henrique', 'Leite', 'Lima', 'Lopes', 'Machado', 'Marques', 'Martins', 'Mendes', 'Monteiro', 'Moreira', 'Moura', 'Nascimento', 'Neves', 'Nunes', 'Oliveira', 'Pereira', 'Pires', 'Ramos', 'Reis', 'Ribeiro', 'Rocha', 'Rodrigues', 'Santos', 'Silva', 'Soares', 'Souza', 'Teixeira', 'Vieira'];

const defaultWorkload = () => ({
  minutesLast7Days: 0,
  minutesLast14Days: 0,
  matchesLast14Days: 0,
  consecutiveStarts: 0,
  highIntensityLoad: 0,
  lastMatchRound: 0,
});

/**
 * Gera elencos IA, restaura worldRosters/userRoster e aplica defaults institucionais.
 * @returns {{
 *   clubs: Record<string, object>,
 *   continuingCareer: boolean,
 *   careerWorldNeedsPersist: boolean,
 *   serieDLayoutRepaired: boolean,
 * }}
 */
export function bootstrapCareerClubs({
  savedNewGame,
  validSavedSeason,
  userClub,
  userDivision,
  careerSeason,
  divisionTeams,
  divisionRules,
  teams,
  squad,
  useCareerOriginFlow,
  careerHostMeta,
  careerPyramidFreshlyGenerated,
  gameRandom,
  int,
  initialEnvironmentRanges,
  assignSquadJerseyNumbers,
  persistCareer,
  initialBudget,
  ensureBudget,
  ensureStadium,
}) {
  let careerWorldNeedsPersist = false;
  let serieDLayoutRepaired = false;
  let userDivisionMembershipRepaired = false;

  const generatedPlayer = (role, index, clubPower, division = 'A', starterBoost = true) =>
    generatePlayerCore({
      role,
      index,
      clubPower,
      division,
      random: gameRandom,
      firstNames: FIRST_NAMES,
      lastNames: LAST_NAMES,
      starterBoost,
    });

  const createClub = (club, division, index) => {
    const rule = divisionRules[division];
    const basePower = int(rule.power[0], rule.power[1]);
    const formation = club === userClub ? '4-3-3' : FORMATIONS_FOR_CLUBS[int(0, FORMATIONS_FOR_CLUBS.length - 1)];
    const roles = buildSquadRoles(rollProfessionalSquadSize(gameRandom));
    const starterFlags = pickStarterFlags(roles.length, gameRandom);
    const roster = roles.map((role, playerIndex) =>
      generatedPlayer(role, playerIndex + index * 29, basePower, division, starterFlags[playerIndex]),
    );
    dedupeRosterNames(roster);
    assignSquadJerseyNumbers(roster);
    const top11 = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
    const power = Math.round(top11.reduce((sum, player) => sum + player.overall, 0) / 11);
    const environmentRange = initialEnvironmentRanges[division];
    const clubUf = getRealClub(club)?.uf || (club === userClub ? savedNewGame?.userUf : null) || null;
    return {
      name: club,
      division,
      uf: clubUf,
      power,
      roster,
      formation,
      style: ['Posse de bola', 'Contra-ataque', 'Pressão alta'][int(0, 2)],
      mentality: ['Defensiva', 'Equilibrada', 'Ofensiva'][int(0, 2)],
      position: index + 1,
      environment: int(...environmentRange),
      support: int(38, 94),
      board: int(38, 94),
      finances: int(35, 96),
    };
  };

  const clubs = {};

  if (savedNewGame) {
    Object.keys(divisionRules).forEach(division => {
      const names = Array.isArray(divisionTeams[division]) ? divisionTeams[division] : [];
      if (division === userDivision) {
        let seenUser = false;
        const normalized = names.filter(name => {
          if (name !== userClub) return true;
          if (seenUser) return false;
          seenUser = true;
          return true;
        });
        if (!seenUser) normalized.unshift(userClub);
        if (normalized.length !== names.length || !seenUser) userDivisionMembershipRepaired = true;
        divisionTeams[division] = normalized;
        return;
      }
      const normalized = names.filter(name => name !== userClub);
      if (normalized.length !== names.length) userDivisionMembershipRepaired = true;
      divisionTeams[division] = normalized;
    });
    if (userDivisionMembershipRepaired) {
      savedNewGame.divisionTeams = Object.fromEntries(
        Object.keys(divisionRules).map(division => [division, [...divisionTeams[division]]]),
      );
      careerWorldNeedsPersist = true;
    }

    Object.entries(divisionTeams).forEach(([division, names]) =>
      names.forEach((club, index) => {
        clubs[club] = createClub(club, division, index);
      }),
    );

    if (useCareerOriginFlow && careerHostMeta?.hostName && (careerPyramidFreshlyGenerated || savedNewGame?.replacementMode === 'cascade')) {
      const isCascadeCareer = savedNewGame?.replacementMode === 'cascade';
      if (isCascadeCareer) {
        const cascadeFix = ensureCascadePyramidIntegrity({
          divisionTeams,
          clubs,
          regionalBaseClubs: savedNewGame.regionalBaseClubs || [],
          userClub,
          victimClub: careerHostMeta.hostName,
          startDivision: savedNewGame.targetDivision || userDivision,
          cascadeSeed: savedNewGame.seed || 0,
        });
        if (cascadeFix.applied) {
          Object.keys(divisionRules).forEach(division => {
            divisionTeams[division] = [...cascadeFix.divisionTeams[division]];
          });
          savedNewGame.regionalBaseClubs = [...cascadeFix.regionalBaseClubs];
          if (Array.isArray(cascadeFix.serieDReplacements) && cascadeFix.serieDReplacements.length) {
            savedNewGame.serieDCascadeReplacements = cascadeFix.serieDReplacements;
          }
          serieDLayoutRepaired = true;
        }
        const victimDivision = cascadeFix.victimDivision || findClubDivision(divisionTeams, careerHostMeta.hostName);
        if (victimDivision && !clubs?.[careerHostMeta.hostName]) {
          const hostIndex = divisionTeams[victimDivision].findIndex(name => name === careerHostMeta.hostName);
          clubs[careerHostMeta.hostName] = createClub(
            careerHostMeta.hostName,
            victimDivision,
            Math.max(0, hostIndex),
          );
        } else if (clubs[careerHostMeta.hostName] && victimDivision) {
          clubs[careerHostMeta.hostName].division = victimDivision;
        }
        if (clubs[userClub]) clubs[userClub].division = cascadeFix.userDivision || userDivision;
        if (cascadeFix.applied) {
          teams.splice(0, teams.length, ...divisionTeams[userDivision]);
          Object.assign(savedNewGame, {
            divisionTeams: Object.fromEntries(Object.keys(divisionRules).map(division => [division, [...divisionTeams[division]]])),
            regionalBaseClubs: [...savedNewGame.regionalBaseClubs],
          });
          persistCareer({ ...savedNewGame });
          careerWorldNeedsPersist = true;
        }
      } else {
        const cascade = finalizeHostReplacementCascade({
          divisionTeams,
          clubs,
          regionalBaseClubs: savedNewGame.regionalBaseClubs || [],
          replacedHostClub: careerHostMeta.hostName,
          hostDivision: careerHostMeta.hostDivision,
          userClub,
        });
        Object.keys(divisionRules).forEach(division => {
          divisionTeams[division] = [...cascade.divisionTeams[division]];
        });
        savedNewGame.regionalBaseClubs = [...cascade.regionalBaseClubs];
        const victimDivision = findClubDivision(cascade.divisionTeams, careerHostMeta.hostName) || cascade.hostClubDivision;
        const victimNeedsClub = cascade.hostClubCreated && cascade.hostClubDivision;
        if (victimNeedsClub && victimDivision) {
          const hostIndex = divisionTeams[victimDivision].findIndex(name => name === careerHostMeta.hostName);
          clubs[careerHostMeta.hostName] = createClub(
            careerHostMeta.hostName,
            victimDivision,
            Math.max(0, hostIndex),
          );
        } else if (clubs[careerHostMeta.hostName] && victimDivision) {
          clubs[careerHostMeta.hostName].division = victimDivision;
        }
        cascade.regionalBaseClubs.forEach(clubName => {
          if (clubs[clubName]) clubs[clubName].regionalBase = true;
        });
        if (clubs[userClub]) clubs[userClub].division = cascade.userDivision || userDivision;
        teams.splice(0, teams.length, ...divisionTeams[userDivision]);
        Object.assign(savedNewGame, {
          divisionTeams: Object.fromEntries(Object.keys(divisionRules).map(division => [division, [...divisionTeams[division]]])),
          regionalBaseClubs: [...savedNewGame.regionalBaseClubs],
        });
        persistCareer({ ...savedNewGame });
        careerWorldNeedsPersist = true;
      }
    }

    if (savedNewGame.worldRosters && typeof savedNewGame.worldRosters === 'object') {
      applyWorldRosters(clubs, savedNewGame.worldRosters, {
        seed: savedNewGame.seed,
        season: careerSeason,
      });
    }

    const user = clubs[userClub];
    if (Array.isArray(savedNewGame.userRoster) && savedNewGame.userRoster.length >= 18) {
      user.roster = savedNewGame.userRoster.map(player => ({
        injuryHistory: [],
        workload: defaultWorkload(),
        ...player,
        fatigue: 100,
      }));
    }
    let userSetPieceRepaired = 0;
    user.roster.forEach(player => {
      if (sanitizeSetPieceForDivision(player, user.division || userDivision)) userSetPieceRepaired += 1;
    });
    user._setPieceRepaired = userSetPieceRepaired;
    assignSquadJerseyNumbers(user.roster);
    squad.splice(0, squad.length, ...user.roster);

    const userEnvironmentRange = initialEnvironmentRanges[userDivision];
    const initialStatus = savedNewGame.clubStatus || {
      environment: int(...userEnvironmentRange),
      support: int(55, 88),
      board: int(55, 88),
      finances: int(55, 88),
    };
    const continuingCareer = !!(validSavedSeason || Array.isArray(savedNewGame.userRoster));
    if (!continuingCareer) {
      user.formation = '4-3-3';
      user.style = 'Posse de bola';
      user.mentality = 'Equilibrada';
    }
    if (continuingCareer) {
      user.environment = clamp(initialStatus.environment, 28, 98);
      user.support = clamp(initialStatus.support, 28, 98);
      user.board = clamp(initialStatus.board, 28, 98);
      user.finances = clamp(initialStatus.finances, 28, 98);
    } else {
      user.environment = clamp(initialStatus.environment, ...userEnvironmentRange);
      user.support = clamp(initialStatus.support, 55, 88);
      user.board = clamp(initialStatus.board, 55, 88);
      user.finances = clamp(initialStatus.finances, 55, 88);
    }
    user.budget = Math.max(0, Number(initialStatus.budget ?? initialBudget(userDivision)));
    ensureBudget(user, userDivision);
  } else {
    teams.forEach((club, index) => {
      if (club === userClub) {
        clubs[club] = {
          name: club,
          division: 'A',
          roster: squad,
          formation: '4-3-3',
          style: 'Posse de bola',
          mentality: 'Equilibrada',
          position: 4,
        };
        return;
      }
      const power = int(...DIVISION_CLUB_POWER.A);
      const squadSize = rollProfessionalSquadSize(gameRandom);
      const roles = buildSquadRoles(squadSize);
      const starterFlags = pickStarterFlags(roles.length, gameRandom);
      const roster = assignSquadJerseyNumbers(
        roles.map((role, i) => generatedPlayer(role, i + index * 5, power, 'A', starterFlags[i])),
      );
      const top11 = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
      clubs[club] = {
        name: club,
        division: 'A',
        power: Math.round(top11.reduce((sum, p) => sum + p.overall, 0) / 11),
        roster,
        formation: FORMATIONS_FOR_CLUBS[int(0, FORMATIONS_FOR_CLUBS.length - 1)],
        style: ['Posse de bola', 'Contra-ataque', 'Pressão alta'][int(0, 2)],
        mentality: ['Defensiva', 'Equilibrada', 'Ofensiva'][int(0, 2)],
        position: index + 1,
      };
    });
  }

  const setPieceRepaired = stampWorldPlayers(clubs, { seed: savedNewGame?.seed || 0, season: careerSeason })
    + (clubs[userClub]?._setPieceRepaired || 0);
  if (clubs[userClub]) delete clubs[userClub]._setPieceRepaired;

  if (savedNewGame) {
    const worldSample = Object.values(savedNewGame.worldRosters || {}).find(roster => Array.isArray(roster) && roster[0])?.[0];
    const worldFat = !!(worldSample && (worldSample.workload || Array.isArray(worldSample.injuryHistory) || worldSample.injuryHistory));
    if (!savedNewGame.worldRosters || worldFat || setPieceRepaired > 0) {
      savedNewGame.worldRosters = collectWorldRosters(clubs, { skipClub: userClub, merge: savedNewGame.worldRosters || {} });
      if (Array.isArray(clubs[userClub]?.roster)) savedNewGame.userRoster = clubs[userClub].roster;
      persistCareer({ ...savedNewGame });
    } else if (userDivisionMembershipRepaired) {
      persistCareer({ ...savedNewGame });
    }
  }

  const continuingCareer = !!(validSavedSeason || (savedNewGame && Array.isArray(savedNewGame.userRoster) && savedNewGame.userRoster.length >= 18));

  // A divisão do perfil da carreira é a fonte de verdade apó acessos e rebaixamentos.
  // Saves antigos podiam restaurar o clube com a divisão da temporada anterior.
  if (clubs[userClub] && ['A', 'B', 'C', 'D'].includes(userDivision)) {
    clubs[userClub].division = userDivision;
  }

  Object.values(clubs).forEach(club => {
    const attackers = club.roster
      .filter(p => ['ATA', 'PE', 'PD', 'MEI', 'MC'].includes(p.pos))
      .sort((a, b) => (b.finishing + b.heading * 0.2) - (a.finishing + a.heading * 0.2));
    const creators = club.roster
      .filter(p => p.pos !== 'GOL')
      .sort((a, b) => (b.passing + b.playmaking) - (a.passing + a.playmaking));
    club.environment = club.environment ?? (club.name === userClub ? 86 : int(...initialEnvironmentRanges[club.division || 'A']));
    club.support = club.support ?? int(42, 92);
    club.board = club.board ?? int(42, 92);
    club.finances = club.finances ?? int(40, 94);
    if (club.name === userClub) {
      if (savedNewGame?.stadiumName) club.stadiumName = String(savedNewGame.stadiumName).trim();
      ensureBudget(club, club.division || userDivision);
      ensureStadium(club, club.division || userDivision, { newGame: !continuingCareer });
    }
    club.medicalInvestment = club.medicalInvestment ?? 0;
    club.preventionProgram = club.preventionProgram ?? 0;
    if (club.name !== userClub) {
      club.pitchCondition = club.pitchCondition || 'good';
      club.pitchLevel = Number.isFinite(Number(club.pitchLevel)) ? club.pitchLevel : 3;
      club.stadiumStructure = Number.isFinite(Number(club.stadiumStructure)) ? club.stadiumStructure : 2;
    }
    club.seasonLeaders = {
      scorer: attackers[0] || club.roster[0],
      goals: savedNewGame ? 0 : int(4, 18),
      assistant: creators[0] || club.roster[1],
      assists: savedNewGame ? 0 : int(3, 14),
    };
  });

  return {
    clubs,
    continuingCareer,
    careerWorldNeedsPersist,
    serieDLayoutRepaired,
  };
}
