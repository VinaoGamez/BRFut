/**
 * Destaques temporários no Elenco — OVR ou status alterados (1 semana).
 */
import { getActiveOvrMark, OVR_MARK_WEEKS } from './player-development.js';
import { activeSuspensions } from './discipline.js';

export const ROSTER_CHANGE_ALERT_WEEKS = OVR_MARK_WEEKS;

const MS_PER_DAY = 86400000;

const escapeAttr = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

const careerDayKey = date => {
  const d = date instanceof Date ? date : date != null ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseCareerDayKey = key => {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
};

const normalizeStatusAlertMap = raw => {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(raw).forEach(([id, mark]) => {
    if (!id || !mark || typeof mark !== 'object') return;
    const at = typeof mark.at === 'string' ? mark.at : '';
    if (!at) return;
    out[id] = { at };
  });
  return out;
}

export function buildPlayerStatusFingerprint(player, { injuryInAcutePhase, injuryInRestrictedPhase } = {}) {
  const inj = player?.injury;
  let injPart = 'ok';
  if (inj && (injuryInAcutePhase?.(inj) || injuryInRestrictedPhase?.(inj))) {
    injPart = `inj:${inj.grade ?? inj.severity ?? ''}:${inj.daysRemaining ?? inj.totalDays ?? 0}:${inj.rehabilitationStage ?? 'acute'}`;
  }
  const susp =
    (activeSuspensions(player?.discipline) || [])
      .map(entry => `${entry.competitionKey}:${entry.gamesRemaining}`)
      .sort()
      .join('|') || 'none';
  const yellows =
    Object.entries(player?.discipline?.yellowByCompetition || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([key, count]) => `${key}:${count}`)
      .sort()
      .join('|') || 'none';
  const contract = player?.contract?.expiresDate || player?.contractUntil || 'none';
  return `${injPart}::${susp}::${yellows}::${contract}`;
}

export function getActiveStatusAlert(state, playerId, careerDate, { weeks = ROSTER_CHANGE_ALERT_WEEKS } = {}) {
  if (!playerId) return null;
  const mark = state?.statusAlertByPlayer?.[playerId];
  if (!mark) return null;
  const at = parseCareerDayKey(mark.at);
  const now = careerDate instanceof Date ? careerDate : careerDate != null ? new Date(careerDate) : null;
  if (!at || !now || Number.isNaN(now.getTime())) return null;
  const ageMs = now.getTime() - at.getTime();
  if (ageMs < -MS_PER_DAY) return null;
  if (ageMs > Math.max(1, Number(weeks) || ROSTER_CHANGE_ALERT_WEEKS) * 7 * MS_PER_DAY) return null;
  return { at: mark.at };
}

export function getActiveRosterChangeAlert(state, playerId, careerDate, options = {}) {
  const ovr = getActiveOvrMark(state, playerId, careerDate, options);
  const status = getActiveStatusAlert(state, playerId, careerDate, options);
  if (!ovr && !status) return null;
  return { ovr, status };
}

export function scanRosterStatusChanges(
  roster,
  state,
  careerDate,
  { getPlayerId, fingerprint } = {},
) {
  if (!state || typeof state !== 'object') return state;
  if (!state.statusSnapByPlayer || typeof state.statusSnapByPlayer !== 'object') state.statusSnapByPlayer = {};
  if (!state.statusAlertByPlayer || typeof state.statusAlertByPlayer !== 'object') state.statusAlertByPlayer = {};
  const dayKey = careerDayKey(careerDate);
  (roster || []).forEach(player => {
    if (!player) return;
    const id = typeof getPlayerId === 'function' ? getPlayerId(player) : null;
    if (!id) return;
    const fp = typeof fingerprint === 'function' ? fingerprint(player) : '';
    const prev = state.statusSnapByPlayer[id];
    if (prev !== undefined && prev !== fp && dayKey) {
      state.statusAlertByPlayer[id] = { at: dayKey };
    }
    state.statusSnapByPlayer[id] = fp;
  });
  return state;
}

export function countActiveRosterChangeAlerts(roster, state, careerDate, getPlayerId) {
  let count = 0;
  (roster || []).forEach(player => {
    const id = typeof getPlayerId === 'function' ? getPlayerId(player) : null;
    if (getActiveRosterChangeAlert(state, id, careerDate)) count += 1;
  });
  return count;
}

export function rosterChangeRowClass(alert) {
  if (!alert) return '';
  const parts = ['player-row--recent-change'];
  if (alert.ovr?.tone) parts.push(`player-row--ovr-${alert.ovr.tone}`);
  if (alert.status) parts.push('player-row--status-change');
  return parts.join(' ');
}
