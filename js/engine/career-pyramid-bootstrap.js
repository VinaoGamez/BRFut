import {
  applyCareerHostNameSwap,
  dedupeAllDivisionTeams,
  injectRealClubsIntoPyramid,
} from './career-club-replacement.js';
import { getAllRealClubs, normClubName } from './brazilian-clubs-by-uf.js';
import { repairDivisionTeamsWithOfficial } from './brazil-official-pyramid.js';
import {
  SERIE_D_CLUBS,
  normalizeDivisionTeamsSerieC,
  serieCClubsForSeason,
  serieCRelegationSlots,
} from './serie-c-calendar.js';

/**
 * Restaura ou gera a pirâmide de divisões (A–D) para uma carreira.
 * @returns {{
 *   divisionTeams: Record<string, string[]>,
 *   careerWorldNeedsPersist: boolean,
 *   serieCSizeRepaired: boolean,
 *   serieDLayoutRepaired: boolean,
 *   careerPyramidFreshlyGenerated: boolean,
 * }}
 */
export function bootstrapCareerDivisionTeams({
  savedNewGame,
  userClub,
  userDivision,
  careerSeason,
  teams,
  divisionRules,
  generatedClubPool,
  officialBrazilWorld,
  useCareerOriginFlow,
  careerHostMeta,
  persistCareer,
}) {
  const divisionTeams = { A: [...teams], B: [], C: [], D: [] };
  let careerWorldNeedsPersist = false;
  let serieCSizeRepaired = false;
  let serieDLayoutRepaired = false;
  let careerPyramidFreshlyGenerated = false;

  if (!savedNewGame) {
    return {
      divisionTeams,
      careerWorldNeedsPersist,
      serieCSizeRepaired,
      serieDLayoutRepaired,
      careerPyramidFreshlyGenerated,
    };
  }

  const worldSeedMatches = !savedNewGame.worldSeed || savedNewGame.worldSeed === savedNewGame.seed;
  const restoredDivisions =
    !savedNewGame.freshWorld
    && worldSeedMatches
    && savedNewGame.divisionTeams
    && Object.keys(divisionRules).every(division => Array.isArray(savedNewGame.divisionTeams[division]));
  const foundingClubName = savedNewGame.foundingClubName || savedNewGame.clubName || userClub;
  const careerClubHistory = Array.isArray(savedNewGame.careerClubHistory)
    ? savedNewGame.careerClubHistory.filter(Boolean)
    : [foundingClubName].filter(Boolean);

  if (restoredDivisions) {
    Object.keys(divisionRules).forEach(division => {
      divisionTeams[division] = [...savedNewGame.divisionTeams[division]];
    });
    Object.assign(divisionTeams, dedupeAllDivisionTeams(divisionTeams));
  } else {
    const protectedNames = new Set(
      [userClub, foundingClubName, ...careerClubHistory, careerHostMeta?.hostName]
        .filter(Boolean)
        .map(name => name.toLocaleLowerCase('pt-BR')),
    );
    if (officialBrazilWorld) {
      divisionTeams.A = [...officialBrazilWorld.divisionTeams.A];
      divisionTeams.B = [...officialBrazilWorld.divisionTeams.B];
      divisionTeams.C = [...officialBrazilWorld.divisionTeams.C];
      divisionTeams.D = [...officialBrazilWorld.divisionTeams.D];
      if (!Array.isArray(savedNewGame.regionalBaseClubs) || !savedNewGame.regionalBaseClubs.length) {
        savedNewGame.regionalBaseClubs = [...officialBrazilWorld.regionalNames];
      }
    } else {
      divisionTeams.A = [...teams];
      const available = generatedClubPool.filter(name => !protectedNames.has(name.toLocaleLowerCase('pt-BR')));
      while (divisionTeams.A.length < divisionRules.A.clubs) {
        const filler = available.shift();
        if (!filler) break;
        divisionTeams.A.push(filler);
      }
      Object.keys(divisionRules).forEach(division => {
        if (division === 'A') return;
        const generatedCount = divisionRules[division].clubs;
        divisionTeams[division] = available.splice(0, generatedCount);
      });
      Object.assign(
        divisionTeams,
        injectRealClubsIntoPyramid(divisionTeams, {
          protectedNames: [userClub, foundingClubName, ...careerClubHistory, careerHostMeta?.hostName].filter(Boolean),
          realClubs: getAllRealClubs(),
          userClub,
          targets: {
            A: divisionRules.A.clubs,
            B: divisionRules.B.clubs,
            C: divisionRules.C.clubs,
            D: divisionRules.D.clubs,
          },
        }),
      );
    }
    if (useCareerOriginFlow && careerHostMeta?.hostName) {
      Object.assign(
        divisionTeams,
        applyCareerHostNameSwap(divisionTeams, {
          userClub,
          replacedHostClub: careerHostMeta.hostName,
          hostDivision: careerHostMeta.hostDivision,
        }),
      );
    } else {
      Object.keys(divisionRules).forEach(division => {
        if (division !== userDivision) return;
        if (divisionTeams[division].some(name => normClubName(name) === normClubName(userClub))) return;
        const swapIndex = divisionTeams[division].findIndex(name => !protectedNames.has(name.toLocaleLowerCase('pt-BR')));
        if (swapIndex >= 0) divisionTeams[division][swapIndex] = userClub;
        else divisionTeams[division].unshift(userClub);
      });
    }
    Object.assign(divisionTeams, dedupeAllDivisionTeams(divisionTeams));
    careerWorldNeedsPersist = true;
    careerPyramidFreshlyGenerated = true;
  }

  const namesInWorld = () => {
    const keys = new Set();
    Object.values(divisionTeams).flat().forEach(name => {
      if (name) keys.add(normClubName(name));
    });
    return keys;
  };
  [foundingClubName, ...careerClubHistory].filter(Boolean).forEach(name => {
    if (namesInWorld().has(normClubName(name))) return;
    divisionTeams.D.push(name);
    careerWorldNeedsPersist = true;
  });

  const serieCNorm = normalizeDivisionTeamsSerieC(divisionTeams, {
    season: careerSeason,
    userClub,
    fillPool: generatedClubPool,
    dTarget: SERIE_D_CLUBS,
  });
  if (serieCNorm.changed) {
    Object.keys(divisionRules).forEach(division => {
      divisionTeams[division] = [...serieCNorm.divisionTeams[division]];
    });
    careerWorldNeedsPersist = true;
    serieCSizeRepaired = true;
  }

  if (officialBrazilWorld && restoredDivisions && savedNewGame?.replacementMode !== 'cascade') {
    const pyramidRepair = repairDivisionTeamsWithOfficial(divisionTeams, officialBrazilWorld, {
      userClub,
      userDivision,
      foundingClubName,
      careerClubHistory,
      replacedHostClub: savedNewGame?.replacedHostClub || careerHostMeta?.hostName || null,
    });
    if (pyramidRepair.changed) {
      Object.keys(divisionRules).forEach(division => {
        divisionTeams[division] = [...pyramidRepair.divisionTeams[division]];
      });
      careerWorldNeedsPersist = true;
      serieDLayoutRepaired = true;
    }
  }

  if (!savedNewGame.foundingClubName || !Array.isArray(savedNewGame.divisionTeams)) {
    careerWorldNeedsPersist = true;
  }

  divisionRules.C.clubs = serieCClubsForSeason(careerSeason);
  divisionRules.C.relegation = serieCRelegationSlots();
  Object.keys(divisionRules).forEach(division => {
    if (division === 'C') return;
    divisionRules[division].clubs = divisionTeams[division].length;
  });
  divisionRules.C.clubs = divisionTeams.C.length;
  teams.splice(0, teams.length, ...divisionTeams[userDivision]);

  if (careerWorldNeedsPersist) {
    Object.assign(savedNewGame, {
      foundingClubName,
      careerClubHistory: [...new Set([foundingClubName, ...careerClubHistory, userClub].filter(Boolean))],
      divisionTeams: Object.fromEntries(Object.keys(divisionRules).map(division => [division, [...divisionTeams[division]]])),
      regionalBaseClubs: Array.isArray(savedNewGame.regionalBaseClubs) ? [...savedNewGame.regionalBaseClubs] : [],
      worldSeed: savedNewGame.seed,
    });
    delete savedNewGame.freshWorld;
    persistCareer({ ...savedNewGame });
  }

  return {
    divisionTeams,
    careerWorldNeedsPersist,
    serieCSizeRepaired,
    serieDLayoutRepaired,
    careerPyramidFreshlyGenerated,
  };
}
