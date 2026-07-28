import {
  SERIE_A_SEED,
  getAllRealClubs,
  getRealClub,
  isRegisteredRealClub,
  normClubName,
  careerDivisionForHost,
} from './brazilian-clubs-by-uf.js';
import { rebalanceSerieDGroups, serieDGroupsNeedRebalance } from './serie-d-formation.js';

export const DIVISION_ORDER = Object.freeze(['A', 'B', 'C', 'D']);

export function nextDivision(division) {
  const index = DIVISION_ORDER.indexOf(division);
  if (index < 0 || index >= DIVISION_ORDER.length - 1) return null;
  return DIVISION_ORDER[index + 1];
}

export function findClubDivision(divisionTeams, clubName) {
  const key = normClubName(clubName);
  for (const division of DIVISION_ORDER) {
    const names = divisionTeams?.[division];
    if (!Array.isArray(names)) continue;
    if (names.some(name => normClubName(name) === key)) return division;
  }
  return null;
}

function replaceNameInDivision(list, fromName, toName) {
  const fromKey = normClubName(fromName);
  const index = list.findIndex(name => normClubName(name) === fromKey);
  if (index < 0) return false;
  list[index] = toName;
  return true;
}

function isGeneratedClubName(name, protectedNames) {
  const key = normClubName(name);
  if (protectedNames.has(key)) return false;
  if (isRegisteredRealClub(name)) return false;
  return true;
}

/** Remove nomes repetidos (comparação normalizada), preservando a 1ª ocorrência. */
export function dedupeDivisionTeamList(names) {
  const seen = new Set();
  const out = [];
  for (const name of names || []) {
    if (!name) continue;
    const key = normClubName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Deduplica A/B/C/D — evita clube fantasma duplicado após swap ou inject. */
export function dedupeAllDivisionTeams(divisionTeams) {
  const next = {};
  for (const division of DIVISION_ORDER) {
    next[division] = dedupeDivisionTeamList(divisionTeams?.[division]);
  }
  return next;
}

/** Lista par e dentro do tamanho da divisão — obrigatório para gerar calendário. */
export function prepareClubListForFixtures(clubList, options = {}) {
  const targetSize = Number(options.targetSize) > 0 ? Number(options.targetSize) : null;
  const userClub = options.userClub || null;
  let names = [...new Set((clubList || []).filter(Boolean))];

  if (targetSize != null && names.length > targetSize) {
    const dropCandidates = names.filter(name => normClubName(name) !== normClubName(userClub));
    while (names.length > targetSize && dropCandidates.length) {
      const dropName = dropCandidates.pop();
      names = names.filter(name => name !== dropName);
    }
    if (names.length > targetSize) names = names.slice(0, targetSize);
  }

  if (names.length % 2 !== 0) {
    const dropIndex = names.findLastIndex(name => normClubName(name) !== normClubName(userClub));
    if (dropIndex >= 0) names.splice(dropIndex, 1);
    else names.pop();
  }

  return names;
}

export function divisionFixturesIncludeClub(fixtures, clubName) {
  if (!clubName || !Array.isArray(fixtures)) return false;
  const key = normClubName(clubName);
  return fixtures.some(round =>
    Array.isArray(round)
    && round.some(game => normClubName(game?.home) === key || normClubName(game?.away) === key),
  );
}

/**
 * Troca clubes fictícios da pirâmide por reais do registry (B/C/D).
 */
export function injectRealClubsIntoPyramid(divisionTeams, options = {}) {
  const protectedNames = new Set(
    (options.protectedNames || []).map(name => normClubName(name)).filter(Boolean),
  );
  const targets = options.targets || {};
  const next = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };

  for (const club of options.realClubs || []) {
    if (!club || club.division === 'REG') continue;
    const clubKey = normClubName(club.name);
    if (protectedNames.has(clubKey)) continue;
    const div = club.division;
    if (!next[div]) continue;
    if (next[div].some(name => normClubName(name) === clubKey)) continue;
    const targetSize = Number(targets[div]) > 0 ? Number(targets[div]) : null;
    const swapIndex = next[div].findIndex(name => isGeneratedClubName(name, protectedNames));
    if (swapIndex >= 0) next[div][swapIndex] = club.name;
    else if (targetSize == null || next[div].length < targetSize) next[div].push(club.name);
  }

  Object.keys(next).forEach(division => {
    const targetSize = Number(targets[division]) > 0 ? Number(targets[division]) : null;
    if (targetSize == null) return;
    next[division] = prepareClubListForFixtures(next[division], {
      targetSize,
      userClub: options.userClub,
    });
  });

  return dedupeAllDivisionTeams(next);
}

/**
 * Substitui o host pelo clube do usuário (nível de nomes, antes dos elencos).
 */
export function applyCareerHostNameSwap(divisionTeams, { userClub, replacedHostClub, hostDivision }) {
  const next = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };

  if (hostDivision === 'REG') {
    if (!next.D.some(name => normClubName(name) === normClubName(userClub))) {
      next.D.push(userClub);
    }
    return dedupeAllDivisionTeams(next);
  }

  const located = findClubDivision(next, replacedHostClub) || hostDivision;
  if (located && replaceNameInDivision(next[located], replacedHostClub, userClub)) {
    return dedupeAllDivisionTeams(next);
  }

  if (hostDivision && Array.isArray(next[hostDivision])) {
    const swapIndex = next[hostDivision].findIndex(name =>
      isGeneratedClubName(name, new Set([normClubName(userClub)])),
    );
    if (swapIndex >= 0) next[hostDivision][swapIndex] = userClub;
    else next[hostDivision].push(userClub);
  }

  return dedupeAllDivisionTeams(next);
}

/** UF do clube (registry Brasfoot / custom). */
export function resolveClubUf(clubName) {
  const fromRegistry = getRealClub(clubName);
  if (fromRegistry?.uf) return String(fromRegistry.uf).toUpperCase();
  const fromImport = getAllRealClubs().find(club => normClubName(club.name) === normClubName(clubName));
  if (fromImport?.uf) return String(fromImport.uf).toUpperCase();
  return null;
}

export function stablePickIndex(length, key) {
  if (length <= 0) return -1;
  let state = 0;
  const text = String(key || '');
  for (let index = 0; index < text.length; index += 1) {
    state = (Math.imul(31, state) + text.charCodeAt(index)) >>> 0;
  }
  return state % length;
}

/**
 * Série D: vítima do cascade ocupa aleatoriamente (estável por seed) a vaga de um clube do mesmo UF.
 * Fallback: menor OVR quando não houver clube do mesmo estado na D.
 */
export function replaceSameUfSlotInSerieD(
  divisionTeams,
  clubs,
  incomingClub,
  regionalBaseClubs,
  { pickIndex, resolveUf = resolveClubUf } = {},
) {
  const regional = [...(regionalBaseClubs || [])];
  const names = [...(divisionTeams?.D || [])];
  if (!names.length) {
    divisionTeams.D = [incomingClub];
    return { evicted: null, regionalBaseClubs: regional, matchedUf: false };
  }

  const incomingKey = normClubName(incomingClub);
  const incomingUf = resolveUf(incomingClub);
  let candidates = names.filter(name => normClubName(name) !== incomingKey);
  let matchedUf = false;

  if (incomingUf) {
    const sameUf = candidates.filter(name => resolveUf(name) === incomingUf);
    if (sameUf.length) {
      candidates = sameUf;
      matchedUf = true;
    }
  }

  if (!candidates.length) {
    return replaceLowestPowerSlot(divisionTeams, clubs, 'D', incomingClub, regional);
  }

  const index =
    typeof pickIndex === 'function'
      ? pickIndex(candidates.length)
      : stablePickIndex(candidates.length, `${incomingClub}|${[...candidates].sort().join('|')}`);
  const evicted = candidates[index >= 0 ? index : 0];
  const slotIndex = names.findIndex(name => normClubName(name) === normClubName(evicted));
  if (slotIndex >= 0) names[slotIndex] = incomingClub;
  else names.push(incomingClub);
  divisionTeams.D = names;

  if (
    evicted &&
    normClubName(evicted) !== incomingKey &&
    !regional.some(name => normClubName(name) === normClubName(evicted))
  ) {
    regional.push(evicted);
  }

  return { evicted, regionalBaseClubs: regional, matchedUf };
}

/**
 * Garante inscrição do usuário na Série D (lista + grupos).
 * Corrige saves onde o clube está na divisão D mas ausente dos grupos/fixtures salvos.
 */
export function ensureSerieDUserEnrollment({
  divisionTeams,
  serieDGroups,
  userClub,
  userDivision,
  clubs,
  rebuildGroups,
}) {
  if (userDivision !== 'D' || !userClub) {
    return { repaired: false, groups: serieDGroups, divisionTeams };
  }

  const userKey = normClubName(userClub);
  const nextTeams = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };
  let repaired = false;
  let groups = Array.isArray(serieDGroups) ? serieDGroups.map(group => [...group]) : [];

  if (!nextTeams.D.some(name => normClubName(name) === userKey)) {
    replaceSameUfSlotInSerieD(nextTeams, clubs, userClub, []);
    repaired = true;
  }

  const inGroup = groups.some(group => group.some(name => normClubName(name) === userKey));
  if (!inGroup && typeof rebuildGroups === 'function') {
    groups = rebuildGroups(nextTeams.D);
    if (groups.some(group => group.some(name => normClubName(name) === userKey))) {
      repaired = true;
    }
  }

  if (!groups.some(group => group.some(name => normClubName(name) === userKey))) {
    const userUf = resolveClubUf(userClub);
    let injected = false;
    for (const group of groups) {
      let slotIdx = -1;
      if (userUf) {
        slotIdx = group.findIndex(
          name => resolveClubUf(name) === userUf && normClubName(name) !== userKey,
        );
      }
      if (slotIdx < 0 && group.length >= 6) {
        slotIdx = group.findIndex(name => normClubName(name) !== userKey);
      }
      if (slotIdx >= 0) {
        const evicted = group[slotIdx];
        group[slotIdx] = userClub;
        const divIdx = nextTeams.D.findIndex(name => normClubName(name) === normClubName(evicted));
        if (divIdx >= 0) nextTeams.D[divIdx] = userClub;
        else if (!nextTeams.D.some(name => normClubName(name) === userKey)) nextTeams.D.push(userClub);
        injected = true;
        repaired = true;
        break;
      }
    }
    if (!injected) {
      const target = groups.find(group => group.length < 6) || groups[groups.length - 1];
      if (target) {
        target.push(userClub);
        if (!nextTeams.D.some(name => normClubName(name) === userKey)) nextTeams.D.push(userClub);
        repaired = true;
      }
    }
  }

  if (repaired || serieDGroupsNeedRebalance(groups)) {
    groups = rebalanceSerieDGroups(repaired ? nextTeams : divisionTeams, groups);
    repaired = true;
  }

  return {
    repaired,
    groups,
    divisionTeams: repaired ? nextTeams : divisionTeams,
  };
}

export function replaceLowestPowerSlot(divisionTeams, clubs, division, incomingClub, regionalBaseClubs) {
  const regional = [...(regionalBaseClubs || [])];
  const names = [...(divisionTeams?.[division] || [])];
  if (!names.length) {
    divisionTeams[division] = [incomingClub];
    return { evicted: null, regionalBaseClubs: regional };
  }

  const sorted = [...names].sort((a, b) => {
    const powerA = Number(clubs?.[a]?.power) || 0;
    const powerB = Number(clubs?.[b]?.power) || 0;
    if (powerA !== powerB) return powerA - powerB;
    return String(a).localeCompare(String(b), 'pt-BR');
  });
  const evicted = sorted[0];
  const index = names.findIndex(name => normClubName(name) === normClubName(evicted));
  if (index >= 0) names[index] = incomingClub;
  else names.push(incomingClub);
  divisionTeams[division] = names;

  if (
    evicted &&
    normClubName(evicted) !== normClubName(incomingClub) &&
    !regional.some(name => normClubName(name) === normClubName(evicted))
  ) {
    regional.push(evicted);
  }

  return { evicted, regionalBaseClubs: regional };
}

export function evictLowestPowerClub(divisionTeams, clubs, division, regionalBaseClubs) {
  const regional = [...(regionalBaseClubs || [])];
  const names = [...(divisionTeams?.[division] || [])];
  if (!names.length) return { evicted: null, regionalBaseClubs: regional };

  const sorted = [...names].sort((a, b) => {
    const powerA = Number(clubs?.[a]?.power) || 0;
    const powerB = Number(clubs?.[b]?.power) || 0;
    if (powerA !== powerB) return powerA - powerB;
    return String(a).localeCompare(String(b), 'pt-BR');
  });
  const evicted = sorted[0];
  divisionTeams[division] = names.filter(name => normClubName(name) !== normClubName(evicted));
  if (evicted && !regional.some(name => normClubName(name) === normClubName(evicted))) {
    regional.push(evicted);
  }
  return { evicted, regionalBaseClubs: regional };
}

export function runFullRelegationCascade({
  divisionTeams,
  clubs,
  regionalBaseClubs,
  victimClub,
  startDivision,
  cascadeSeed = 0,
}) {
  const nextTeams = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };
  let regional = [...(regionalBaseClubs || [])];
  let incoming = victimClub;
  let division = nextDivision(startDivision);
  const serieDReplacements = [];

  while (division && incoming) {
    const eviction =
      division === 'D'
        ? replaceSameUfSlotInSerieD(nextTeams, clubs, incoming, regional, {
            pickIndex: len => stablePickIndex(len, `${cascadeSeed}|${incoming}|${division}`),
          })
        : replaceLowestPowerSlot(nextTeams, clubs, division, incoming, regional);
    if (division === 'D' && eviction.evicted) {
      serieDReplacements.push({ from: eviction.evicted, to: incoming });
    }
    regional = eviction.regionalBaseClubs;
    incoming = eviction.evicted;
    division = nextDivision(division);
  }

  if (incoming && !regional.some(name => normClubName(name) === normClubName(incoming))) {
    regional.push(incoming);
  }

  Object.assign(divisionTeams, nextTeams);
  return {
    divisionTeams: nextTeams,
    regionalBaseClubs: regional,
    userDivision: startDivision,
    hostClubDivision: nextDivision(startDivision),
    serieDReplacements,
  };
}

/**
 * Garante pirâmide coerente em carreiras cascade (vítima desce 1+ divisões).
 * Corrige saves onde a vítima sumiu após repair da pirâmide oficial.
 * @returns {{ applied: boolean, divisionTeams: object, regionalBaseClubs: string[], victimDivision: string|null }}
 */
export function ensureCascadePyramidIntegrity({
  divisionTeams,
  clubs,
  regionalBaseClubs,
  userClub,
  victimClub,
  startDivision,
  cascadeSeed = 0,
}) {
  const startDiv = String(startDivision || 'A').toUpperCase();
  const victim = victimClub || null;
  const user = userClub || null;
  if (!victim || !user || !DIVISION_ORDER.includes(startDiv)) {
    return {
      applied: false,
      divisionTeams,
      regionalBaseClubs: regionalBaseClubs || [],
      victimDivision: findClubDivision(divisionTeams, victim),
    };
  }

  const victimKey = normClubName(victim);
  const userKey = normClubName(user);
  const victimDiv = findClubDivision(divisionTeams, victim);
  const userInStart = (divisionTeams[startDiv] || []).some(name => normClubName(name) === userKey);
  const victimInStart = (divisionTeams[startDiv] || []).some(name => normClubName(name) === victimKey);
  const expectedVictimDiv = nextDivision(startDiv);
  const victimInRegional = (regionalBaseClubs || []).some(name => normClubName(name) === victimKey);
  const victimOk =
    victimDiv
    && victimDiv !== startDiv
    && !victimInRegional
    && (!expectedVictimDiv || victimDiv === expectedVictimDiv);

  if (userInStart && victimOk) {
    return {
      applied: false,
      divisionTeams,
      regionalBaseClubs: regionalBaseClubs || [],
      victimDivision: victimDiv,
    };
  }

  const swapped = applyCareerHostNameSwap(divisionTeams, {
    userClub: user,
    replacedHostClub: victim,
    hostDivision: startDiv,
  });
  Object.assign(divisionTeams, swapped);

  const cascade = runFullRelegationCascade({
    divisionTeams,
    clubs,
    regionalBaseClubs: regionalBaseClubs || [],
    victimClub: victim,
    startDivision: startDiv,
    cascadeSeed,
  });

  Object.assign(divisionTeams, cascade.divisionTeams);
  const victimDivision = findClubDivision(cascade.divisionTeams, victim) || cascade.hostClubDivision;
  const regional = (cascade.regionalBaseClubs || []).filter(
    name => normClubName(name) !== victimKey,
  );

  return {
    applied: true,
    divisionTeams: cascade.divisionTeams,
    regionalBaseClubs: regional,
    victimDivision,
    userDivision: cascade.userDivision,
    serieDReplacements: cascade.serieDReplacements || [],
  };
}

/**
 * Após gerar elencos/OVR: host desce 1 divisão e expulsa o menor OVR para a base regional.
 * @deprecated Preferir runFullRelegationCascade para nova carreira v6.
 */
export function finalizeHostReplacementCascade({
  divisionTeams,
  clubs,
  regionalBaseClubs,
  replacedHostClub,
  hostDivision,
  userClub,
}) {
  const nextTeams = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };
  let regional = [...(regionalBaseClubs || [])];
  let userDivision = careerDivisionForHost({ division: hostDivision });

  if (hostDivision === 'REG') {
    nextTeams.D = nextTeams.D.filter(name => normClubName(name) !== normClubName(userClub));
    const eviction = replaceSameUfSlotInSerieD(nextTeams, clubs, userClub, regional);
    regional = eviction.regionalBaseClubs;
    userDivision = 'D';
    return {
      divisionTeams: nextTeams,
      regionalBaseClubs: regional,
      userDivision,
      hostClubCreated: true,
      serieDReplacements: eviction.evicted ? [{ from: eviction.evicted, to: userClub }] : [],
    };
  }

  const lowerDivision = nextDivision(hostDivision);
  if (!lowerDivision) {
    if (!regional.some(name => normClubName(name) === normClubName(replacedHostClub))) {
      regional.push(replacedHostClub);
    }
    userDivision = hostDivision;
    return {
      divisionTeams: nextTeams,
      regionalBaseClubs: regional,
      userDivision,
      hostClubCreated: false,
      serieDReplacements: [],
    };
  }

  const eviction =
    lowerDivision === 'D'
      ? replaceSameUfSlotInSerieD(nextTeams, clubs, replacedHostClub, regional)
      : replaceLowestPowerSlot(nextTeams, clubs, lowerDivision, replacedHostClub, regional);
  regional = eviction.regionalBaseClubs;
  userDivision = hostDivision;

  return {
    divisionTeams: nextTeams,
    regionalBaseClubs: regional,
    userDivision,
    hostClubCreated: !clubs?.[replacedHostClub],
    hostClubDivision: lowerDivision,
    serieDReplacements:
      lowerDivision === 'D' && eviction.evicted
        ? [{ from: eviction.evicted, to: replacedHostClub }]
        : [],
  };
}

export function hasCareerOriginReplacement(careerSave) {
  if (!careerSave?.userUf) return false;
  const mode = careerSave?.replacementMode;
  if (mode === 'cascade') {
    const div = careerSave?.targetDivision || careerSave?.division;
    return ['A', 'B', 'C', 'D'].includes(div);
  }
  return Boolean(careerSave?.replacedHostClub) && ['manual', 'random'].includes(mode);
}

export function resolveHostClubMeta(careerSave) {
  const hostName = careerSave?.replacedHostClub;
  const hostDivision =
    careerSave?.targetDivision || careerSave?.hostDivision || getRealClub(hostName)?.division || 'A';
  return {
    hostName,
    hostDivision,
    userDivision: careerSave?.targetDivision || careerSave?.division || careerDivisionForHost({ division: hostDivision }),
    registry: getRealClub(hostName),
  };
}

export function buildSerieATemplate(userClub, useOriginFlow) {
  const base = [...SERIE_A_SEED];
  if (!useOriginFlow && userClub) {
    if (!base.some(name => normClubName(name) === normClubName(userClub))) {
      base.splice(3, 0, userClub);
    }
  }
  return base;
}
