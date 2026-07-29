/**
 * Treino de desenvolvimento — XP diário, evolução de atributos e custo de fadiga.
 * OVR recalculado via generatedOverall (Opção A); complementa pulsos por partida.
 */
import { MODULE_VERSIONS } from '../core/constants.js';
import { formatOvrMarkHtml } from './player-development.js';
import { syncOverallFromAttributes } from './player-generation.js';
import { clubHasYouthTrainingTargets } from './youth-academy.js';

export const TRAINING_MODULE_VERSION = MODULE_VERSIONS.trainingDevelopment || 1;

export const TRAINING_FREE_MODES = {
  load: 'load',
  development: 'development',
};

export const DEVELOPMENT_FOCUS_IDS = [
  'finishing',
  'passing',
  'defense',
  'dribble',
  'aerial',
  'goalkeeper',
  'individual',
  'youth',
];

/** @type {Record<string, { label: string, attrs: string[]|null, fatigue: number, positions: string[]|null }>} */
export const DEVELOPMENT_FOCUSES = {
  finishing: {
    label: 'Finalização',
    attrs: ['finishing', 'heading'],
    fatigue: 6,
    positions: ['ATA', 'MEI', 'PE', 'PD'],
  },
  passing: {
    label: 'Passes & Visão',
    attrs: ['passing', 'playmaking'],
    fatigue: 5,
    positions: ['MC', 'MEI', 'VOL', 'LAT'],
  },
  defense: {
    label: 'Defesa & Desarme',
    attrs: ['marking', 'tackling'],
    fatigue: 6,
    positions: ['ZAG', 'VOL', 'LAT'],
  },
  dribble: {
    label: 'Condução & Velocidade',
    attrs: ['dribble', 'speed'],
    fatigue: 6,
    positions: ['PE', 'PD', 'ATA', 'MEI'],
  },
  aerial: {
    label: 'Jogo aéreo & Físico',
    attrs: ['heading', 'marking'],
    fatigue: 5,
    positions: ['ZAG', 'ATA', 'VOL'],
  },
  goalkeeper: {
    label: 'Goleiro',
    attrs: ['reflexes', 'positioning', 'penaltySaving'],
    fatigue: 3,
    positions: ['GOL'],
  },
  individual: {
    label: 'Individual',
    attrs: null,
    fatigue: 4,
    positions: null,
  },
  youth: {
    label: 'Juvenis',
    attrs: null,
    fatigue: 4,
    positions: null,
  },
};

export const ATTR_SHORT_LABELS = {
  finishing: 'Fin',
  passing: 'Pas',
  marking: 'Mar',
  tackling: 'Des',
  dribble: 'Dri',
  speed: 'Vel',
  heading: 'Cab',
  playmaking: 'Arm',
  reflexes: 'Ref',
  positioning: 'Pos',
  penaltySaving: 'Def',
};

const ATTR_BY_POS = {
  GOL: ['reflexes', 'positioning', 'penaltySaving', 'passing'],
  ZAG: ['marking', 'tackling', 'heading', 'passing'],
  LAT: ['speed', 'tackling', 'passing', 'dribble'],
  VOL: ['tackling', 'marking', 'passing', 'heading'],
  MC: ['passing', 'dribble', 'tackling', 'finishing'],
  MEI: ['passing', 'dribble', 'finishing', 'speed'],
  PE: ['speed', 'dribble', 'finishing', 'passing'],
  PD: ['speed', 'dribble', 'finishing', 'passing'],
  ATA: ['finishing', 'heading', 'speed', 'dribble'],
};

export const BASE_TRAINING_XP = 12;
export const XP_PER_ATTR_POINT = 100;
const MIN_ENERGY_TO_TRAIN = 25;
const LOW_ENERGY_THRESHOLD = 35;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function normalizeTrainingRules(rules = {}) {
  const base = {
    before: 'Preparação tática',
    after: 'Recuperação',
    free: 'Treino equilibrado',
    freeMode: TRAINING_FREE_MODES.load,
    developmentFocus: 'individual',
  };
  const merged = { ...base, ...(rules && typeof rules === 'object' ? rules : {}) };
  if (!DEVELOPMENT_FOCUS_IDS.includes(merged.developmentFocus)) merged.developmentFocus = 'individual';
  if (!Object.values(TRAINING_FREE_MODES).includes(merged.freeMode)) merged.freeMode = TRAINING_FREE_MODES.load;
  return merged;
}

export function emptyTrainingProgress() {
  return { xpSeason: 0, ovrFromTraining: 0, attrGains: {} };
}

export function ensureTrainingProgress(state, playerId) {
  if (!state.trainingByPlayer || typeof state.trainingByPlayer !== 'object') state.trainingByPlayer = {};
  if (!state.trainingByPlayer[playerId]) state.trainingByPlayer[playerId] = emptyTrainingProgress();
  return state.trainingByPlayer[playerId];
}

export function emptyWeeklyTrainingReport() {
  return {
    days: 0,
    totalXp: 0,
    gains: [],
    blockedCount: 0,
    exhaustedWarning: false,
    avgEnergy: null,
  };
}

function annualCaps(age) {
  const a = Number(age) || 25;
  if (a <= 22) return { maxOvr: 2, maxAttr: 4 };
  if (a <= 26) return { maxOvr: 1, maxAttr: 3 };
  if (a <= 32) return { maxOvr: 1, maxAttr: 2 };
  return { maxOvr: 0, maxAttr: 1 };
}

function ageMultiplier(age) {
  const a = Number(age) || 25;
  if (a <= 22) return 1.25;
  if (a <= 26) return 1;
  if (a <= 29) return 0.7;
  if (a <= 32) return 0.45;
  return 0.2;
}

function minutesMultiplier(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 0) return 1.2;
  if (m < 180) return 1;
  if (m < 450) return 0.55;
  return 0.3;
}

function potentialMultiplier(player) {
  const ovr = Number(player.overall) || 50;
  const pot = Number(player.potential) || ovr;
  const gap = pot - ovr;
  if (gap >= 3) return 1;
  if (gap <= 0) return 0.15;
  return 0.15 + (gap / 3) * 0.85;
}

function focusMatchMultiplier(player, focusId) {
  if (focusId === 'individual' || focusId === 'youth') return 1;
  const def = DEVELOPMENT_FOCUSES[focusId];
  if (!def) return 0.65;
  if (focusId === 'goalkeeper') return player.pos === 'GOL' ? 1 : 0.45;
  if (def.positions?.includes(player.pos)) return 1;
  return 0.65;
}

function pickIndividualAttrs(player) {
  const keys = ATTR_BY_POS[player.pos] || ['passing', 'speed', 'dribble', 'finishing'];
  return [...keys]
    .map(key => [key, Number(player[key]) || 0])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key]) => key);
}

function focusAttrKeys(focusId, player) {
  if (focusId === 'individual' || focusId === 'youth') return pickIndividualAttrs(player);
  return DEVELOPMENT_FOCUSES[focusId]?.attrs || ['passing'];
}

function attrCapForPlayer(player) {
  const pot = Number(player.potential) || Number(player.overall) || 99;
  const age = Number(player.age) || 25;
  return age <= 26 ? Math.min(99, pot + 4) : pot;
}

function canRaiseAttr(player, key, progress, caps) {
  const gained = Number(progress.attrGains?.[key]) || 0;
  if (gained >= caps.maxAttr) return false;
  const cur = Number(player[key]) || 0;
  return cur < attrCapForPlayer(player);
}

function pickTrainableAttr(player, focusId, progress, caps) {
  const keys = focusAttrKeys(focusId, player);
  for (const key of keys) {
    if (canRaiseAttr(player, key, progress, caps)) return key;
  }
  const posKeys = ATTR_BY_POS[player.pos] || keys;
  for (const key of posKeys) {
    if (canRaiseAttr(player, key, progress, caps)) return key;
  }
  return null;
}

function careerDayKey(date) {
  const d = date instanceof Date ? date : date != null ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordOvrMark(state, playerId, delta, date) {
  if (!state.ovrMarkByPlayer || typeof state.ovrMarkByPlayer !== 'object') state.ovrMarkByPlayer = {};
  state.ovrMarkByPlayer[playerId] = { delta: Math.round(Number(delta) || 0), at: careerDayKey(date) };
}

/**
 * @param {object} opts
 * @param {object[]} opts.roster
 * @param {string} opts.focus
 * @param {object} opts.state — playerDevelopment
 * @param {Function} opts.getPlayerId
 * @param {Function} [opts.getSeasonMinutes]
 * @param {number} [opts.institutionRecovery]
 * @param {Date} [opts.careerDate]
 */
export function applyDevelopmentTrainingDay({
  roster = [],
  focus = 'individual',
  state,
  getPlayerId,
  getSeasonMinutes = () => 0,
  institutionRecovery = 1,
  careerDate = null,
} = {}) {
  const focusId = DEVELOPMENT_FOCUSES[focus] ? focus : 'individual';
  const focusDef = DEVELOPMENT_FOCUSES[focusId];
  const gains = [];
  let totalXp = 0;
  let blockedCount = 0;
  let energySum = 0;
  let energyCount = 0;
  let exhaustedWarning = false;
  let changed = false;

  roster.forEach(player => {
    if (!player) return;
    const playerId = typeof getPlayerId === 'function' ? getPlayerId(player) : null;
    if (!playerId) return;

    const energy = clamp(Number(player.fatigue) || 0, 0, 100);
    energySum += energy;
    energyCount += 1;

    if (energy < MIN_ENERGY_TO_TRAIN) {
      blockedCount += 1;
      return;
    }

    const minutes = getSeasonMinutes(player);
    if (minutes >= 450 && energy < 50) exhaustedWarning = true;

    let xp =
      BASE_TRAINING_XP *
      focusMatchMultiplier(player, focusId) *
      ageMultiplier(player.age) *
      minutesMultiplier(minutes) *
      potentialMultiplier(player) *
      institutionRecovery;

    if (energy < LOW_ENERGY_THRESHOLD) xp *= 0.5;

    if (xp <= 0) return;

    player.fatigue = clamp(energy - focusDef.fatigue, 0, 100);
    totalXp += xp;

    const progress = ensureTrainingProgress(state, playerId);
    progress.xpSeason = (Number(progress.xpSeason) || 0) + xp;

    const caps = annualCaps(player.age);
    while (progress.xpSeason >= XP_PER_ATTR_POINT) {
      if ((Number(progress.ovrFromTraining) || 0) >= caps.maxOvr && caps.maxOvr === 0) {
        progress.xpSeason = Math.min(progress.xpSeason, XP_PER_ATTR_POINT - 1);
        break;
      }
      const attrKey = pickTrainableAttr(player, focusId, progress, caps);
      if (!attrKey) {
        progress.xpSeason = Math.min(progress.xpSeason, XP_PER_ATTR_POINT - 1);
        break;
      }

      const beforeAttr = Number(player[attrKey]) || 0;
      player[attrKey] = clamp(beforeAttr + 1, 1, 99);
      progress.attrGains[attrKey] = (Number(progress.attrGains[attrKey]) || 0) + 1;
      progress.xpSeason -= XP_PER_ATTR_POINT;

      const ovrBefore = Number(player.overall) || 0;
      const ovrSync = syncOverallFromAttributes(player);
      let ovrDelta = ovrSync.applied;

      if (ovrDelta > 0) {
        const room = caps.maxOvr - (Number(progress.ovrFromTraining) || 0);
        if (room <= 0) {
          player.overall = ovrBefore;
          ovrDelta = 0;
        } else if (ovrDelta > room) {
          player.overall = ovrBefore + room;
          ovrDelta = room;
        }
        if (ovrDelta > 0) progress.ovrFromTraining = (Number(progress.ovrFromTraining) || 0) + ovrDelta;
      }

      gains.push({
        playerId,
        playerName: player.name,
        attr: attrKey,
        attrLabel: ATTR_SHORT_LABELS[attrKey] || attrKey,
        attrDelta: 1,
        ovrDelta,
      });
      recordOvrMark(state, playerId, ovrDelta || 0, careerDate);
      changed = true;
    }
  });

  return {
    dayApplied: true,
    changed,
    totalXp: Math.round(totalXp),
    gains,
    blockedCount,
    exhaustedWarning,
    avgEnergy: energyCount ? Math.round(energySum / energyCount) : null,
    focusId,
    focusLabel: focusDef.label,
  };
}

export function finalizeWeeklyTrainingReport(accumulator, rules = {}) {
  const acc = accumulator || emptyWeeklyTrainingReport();
  const normalized = normalizeTrainingRules(rules);
  const modeLabel =
    normalized.freeMode === TRAINING_FREE_MODES.development
      ? `Desenvolvimento · ${DEVELOPMENT_FOCUSES[normalized.developmentFocus]?.label || 'Individual'}`
      : `Gestão de Carga · ${normalized.free || 'Treino equilibrado'}`;

  const playerEntries = [];
  const byName = new Map();
  (acc.gains || []).forEach(entry => {
    const name = entry.playerName;
    if (!name) return;
    let row = byName.get(name);
    if (!row) {
      row = { name, playerId: entry.playerId || '', ovrDelta: 0, overall: null };
      byName.set(name, row);
      playerEntries.push(row);
    }
    row.ovrDelta += Number(entry.ovrDelta) || 0;
    if (entry.playerId) row.playerId = entry.playerId;
  });
  const playerNames = playerEntries.map(entry => entry.name);

  const days = Number(acc.days) || 0;
  const dayWord = days === 1 ? 'dia' : 'dias';
  const introBase = `Depois de ${days} ${dayWord} de treinamento ${modeLabel}`;

  const formatPlayerLine = entry => {
    if (entry.ovrDelta > 0 && entry.overall != null) {
      return `- ${entry.name} · OVR ${entry.overall}↑`;
    }
    return `- ${entry.name}`;
  };

  let body;
  if (playerEntries.length) {
    body = `${introBase}, os seguintes jogadores evoluiram:\n\n${playerEntries.map(formatPlayerLine).join('\n')}`;
  } else {
    body = `${introBase}, nenhum jogador evoluiu nesta semana.`;
  }
  if (acc.avgEnergy != null) {
    body += `\n\nEnergia Média da equipe após treinamento é ${acc.avgEnergy}%`;
  }
  if (acc.blockedCount > 0) {
    body += `\n\n${acc.blockedCount} jogador(es) não treinou por falta de energia.`;
  }
  if (acc.exhaustedWarning) {
    body += '\n\nAtenção: titulares exaustos — considere Gestão de Carga.';
  }

  return {
    ...acc,
    modeLabel,
    playerNames,
    playerEntries,
    body,
    gainLines: playerNames,
  };
}

const normalizeTrainingPlayerEntries = players => {
  if (!Array.isArray(players)) return [];
  return players.map(entry =>
    typeof entry === 'string'
      ? { name: entry, playerId: '', ovrDelta: 0, overall: null }
      : {
          name: entry.name || entry.playerName || '',
          playerId: entry.playerId || '',
          ovrDelta: Number(entry.ovrDelta) || 0,
          overall: entry.overall != null ? Number(entry.overall) : null,
        },
  ).filter(entry => entry.name);
};

export function formatTrainingWeeklyReportHtml(report = {}) {
  const days = Number(report.days) || 0;
  const dayWord = days === 1 ? 'dia' : 'dias';
  const modeLabel = report.modeLabel || 'Treino';
  const players = normalizeTrainingPlayerEntries(report.playerEntries || report.playerNames);
  const energy = report.avgEnergy;

  const esc = value =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const playerRowHtml = entry => {
    const ovrPart =
      entry.ovrDelta > 0 && entry.overall != null
        ? `<span class="training-report-ovr">${entry.overall}${formatOvrMarkHtml(entry.ovrDelta, { weeks: 1 })}</span>`
        : '';
    return `<li class="training-report-player-row"><span class="training-report-player-name">${esc(entry.name)}</span>${ovrPart}</li>`;
  };

  let html = `<p class="training-report-intro">Depois de ${days} ${dayWord} de treinamento ${esc(modeLabel)}, `;
  if (players.length) {
    html += 'os seguintes jogadores evoluiram:</p>';
    html += `<ul class="training-report-players">${players.map(playerRowHtml).join('')}</ul>`;
  } else {
    html += 'nenhum jogador evoluiu nesta semana.</p>';
  }
  if (energy != null) {
    html += `<p class="training-report-energy">Energia Média da equipe após treinamento é <strong>${esc(energy)}%</strong></p>`;
  }
  return html;
}

export function rosterHasGoalkeeper(roster = []) {
  return roster.some(player => player?.pos === 'GOL');
}

export function developmentFocusOptionsForRoster(roster = [], club = null) {
  return developmentFocusOptionsForClub(club || { roster });
}

export function developmentFocusOptionsForClub(club = {}) {
  const roster = Array.isArray(club.roster) ? club.roster : [];
  const youthUnlocked = clubHasYouthTrainingTargets(club);
  return DEVELOPMENT_FOCUS_IDS.filter(id => {
    if (id === 'goalkeeper') return rosterHasGoalkeeper(roster);
    if (id === 'youth') return youthUnlocked;
    return true;
  }).map(id => ({
    id,
    label: DEVELOPMENT_FOCUSES[id].label,
  }));
}

export function getTrainingProgressForPlayer(state, playerId) {
  if (!playerId || !state?.trainingByPlayer) return null;
  return state.trainingByPlayer[playerId] || null;
}

export function trainingAttrGainTotal(progress) {
  if (!progress?.attrGains || typeof progress.attrGains !== 'object') return 0;
  return Object.values(progress.attrGains).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

/**
 * HTML da coluna XP no Elenco (barra + valor atual / 100).
 * @param {object|null} progress
 * @param {{ active?: boolean }} opts — active=false quando modo Gestão de Carga
 */
export function formatRosterTrainingXpHtml(progress, { active = true } = {}) {
  if (!active) {
    return '<span class="roster-training-xp is-idle" title="Modo Gestão de Carga — sem acúmulo de XP">—</span>';
  }
  const xp = Math.max(0, Math.min(XP_PER_ATTR_POINT - 1, Math.round(Number(progress?.xpSeason) || 0)));
  const pct = Math.round((xp / XP_PER_ATTR_POINT) * 100);
  const attrTotal = trainingAttrGainTotal(progress);
  const ovrGain = Number(progress?.ovrFromTraining) || 0;
  let title = `XP de treino: ${xp}/${XP_PER_ATTR_POINT} até o próximo atributo`;
  if (attrTotal > 0) title += ` · +${attrTotal} atributo(s) na temporada`;
  if (ovrGain > 0) title += ` · +${ovrGain} OVR por treino`;
  const gainBadge =
    attrTotal > 0
      ? `<small class="roster-training-gain" title="Ganhos por treino na temporada">+${attrTotal}</small>`
      : '';
  return `<span class="roster-training-xp" title="${title}"><i><b style="width:${pct}%"></b><em>${xp}</em></i>${gainBadge}</span>`;
}

/** Resumo do XP acumulado no elenco (sidebar / relatórios). */
export function summarizeSquadTrainingXp(state, roster = [], getPlayerId = p => p?.name) {
  let xpSum = 0;
  let activeCount = 0;
  let attrGains = 0;
  (roster || []).forEach(player => {
    const id = typeof getPlayerId === 'function' ? getPlayerId(player) : null;
    if (!id) return;
    const row = getTrainingProgressForPlayer(state, id);
    if (!row) return;
    const xp = Number(row.xpSeason) || 0;
    if (xp > 0) {
      activeCount += 1;
      xpSum += xp;
    }
    attrGains += trainingAttrGainTotal(row);
  });
  return {
    activeCount,
    avgXp: activeCount ? Math.round(xpSum / activeCount) : 0,
    attrGains,
  };
}
