/**
 * Build pública para testers.
 * Nomenclatura: Alpha V.X.YY — sobe +0.05 a cada publicação (1.00 → 1.05 → …).
 */
export const BUILD_VERSION = 'Alpha V.4.40';

/** Nome público do jogo (UI, títulos, alertas de update). */
export const GAME_BRAND_NAME = 'BR Fut';
export const GAME_BRAND_UPDATE_TITLE = `${GAME_BRAND_NAME} foi atualizado`;

/** Rodadas da fase de grupos da Série D (1ª fase). */
export const SERIE_D_GROUP_ROUNDS = 10;

/** Chaves atuais de persistência (local + nuvem). */
export const SAVE_KEYS = {
  career: 'brfut-career',
  season: 'brfut-season',
  training: 'brfut-training-rules',
  pace: 'futmanager-pace',
  liveMatch: 'brfut-live-match',
  lastSeenBuild: 'brfut-last-seen-build',
  playerHistory: 'brfut-player-history',
};

/** Índice de múltiplas carreiras por usuário. */
export const CAREER_INDEX_KEY = 'brfut-career-index';
export const ACTIVE_SLOT_SESSION_KEY = 'brfut-active-slot-id';
export const CAREER_SLOT_LIMIT = 5;

/** Chaves do bundle de um slot de carreira. */
export function slotBundleKeys(slotId) {
  const id = String(slotId || '').trim();
  return {
    career: `brfut-slot-${id}-career`,
    season: `brfut-slot-${id}-season`,
    playerHistory: `brfut-slot-${id}-player-history`,
    liveMatch: `brfut-slot-${id}-live-match`,
  };
}

export function isSlotBundleKey(key) {
  return /^brfut-slot-[a-zA-Z0-9-]+-(career|season|player-history|live-match)$/.test(String(key || ''));
}

export function isSyncableSaveKey(key) {
  if (ALL_SYNCABLE_SAVE_KEYS.includes(key)) return true;
  if (key === CAREER_INDEX_KEY) return true;
  return isSlotBundleKey(key);
}

/** Chaves legadas (Matchday) — migração automática no boot. */
export const LEGACY_SAVE_KEYS = {
  career: 'matchday-new-game',
  season: 'matchday-season',
  training: 'matchday-training-rules',
  liveMatch: 'matchday-live-match',
  lastSeenBuild: 'matchday-last-seen-build',
  playerHistory: 'matchday-player-history',
};

/** Todas as chaves syncáveis (nova + legado) para hydrate/delete na nuvem. */
export const ALL_SYNCABLE_SAVE_KEYS = [
  ...new Set([...Object.values(SAVE_KEYS), ...Object.values(LEGACY_SAVE_KEYS)]),
];

/** Variantes nova + legado de uma chave de save. */
export function saveKeyVariants(key) {
  const variants = new Set([key]);
  Object.entries(SAVE_KEYS).forEach(([logical, newKey]) => {
    const legacyKey = LEGACY_SAVE_KEYS[logical];
    if (newKey === key || legacyKey === key) {
      variants.add(newKey);
      if (legacyKey) variants.add(legacyKey);
    }
  });
  return [...variants];
}

export const SAVE_VERSION = {
  career: 4,
  season: 1,
  playerHistory: 1,
};

export const MODULE_VERSIONS = {
  messages: 1,
  save: 4,
  injury: 4,
  matchTuning: 1,
  matchSim: 2,
  matchCore: 1,
  matchLive: 4,
  calendar: 5,
  dashboard: 6,
  tactics: 3,
  seasonSummary: 2,
  seasonTransition: 1,
  discipline: 2,
  economy: 30,
  options: 3,
  sponsorPicker: 4,
  liveDayMatches: 1,
  fatigue: 1,
  trainingDevelopment: 1,
  matchLiveUi: 9,
  matchLiveAudio: 6,
  playerRename: 1,
  testerHub: 1,
  matchAvailability: 1,
  matchLiveAwaySubs: 1,
  matchLiveOrchestration: 5,
  matchRatings: 1,
  matchLiveSession: 6,
  liveMatchPersist: 2,
  clubStatus: 10,
  managerRanking: 2,
  seasonGoals: 2,
  managerJob: 3,
  careerPersistence: 1,
  careerCalendar: 1,
  managerJobWarn: 1,
  managerSack: 1,
  clubSolvency: 2,
  clubBankruptcy: 1,
  clubInsolvencyWarn: 3,
  clubFinancialRestriction: 1,
  playerHistory: 1,
  playerMatchStats: 1,
  playerDevelopment: 1,
  transfers: 5,
};

/** Vite injeta `__BRFUT_ENABLE_TRANSFERS__`; em Node/scripts fica off. */
function readTransfersFlag() {
  try {
    return Boolean(__BRFUT_ENABLE_TRANSFERS__);
  } catch {
    return false;
  }
}

/** Origem estadual + fluxo de substituição na pirâmide — local e GitHub Pages. */
function readStateLeagueFlag() {
  try {
    return Boolean(__BRFUT_ENABLE_STATE_LEAGUE__);
  } catch {
    return false;
  }
}

/** Página inicial (career welcome em index.html). */
export const SITE_MAINTENANCE = {
  enabled: false,
  message: 'SERVIDOR EM MANUTENÇÃO',
};

/** Origem da API em produção (ex.: https://api.brfut.com.br). Vazio = mesma origem (5081). */
export const BRFUT_API_ORIGIN =
  typeof __BRFUT_API_ORIGIN__ !== 'undefined' && __BRFUT_API_ORIGIN__ ? __BRFUT_API_ORIGIN__ : '';

/** Flags para builds de testers — evoluir sem quebrar fluxo congelado. */
export const FEATURES = {
  messagesHub: true,
  calendarRoutines: true,
  medicalTreatment: true,
  externalTunnel: true,
  /** Mercado ativo em local e GitHub Pages. */
  transfers: readTransfersFlag(),
  /** Copa do Mundo de Seleções — calendário FIFA 2026 + simulação progressiva. */
  worldCup: true,
  /** Origem estadual (UF + host) e campeonato estadual. */
  stateLeague: readStateLeagueFlag(),
};
