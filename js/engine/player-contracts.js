/**
 * Contratos semestrais de jogadores (v1 — estilo Brasfoot).
 * Semestre = +6 meses civis; reajuste só na renovação; sem auto-renew.
 */

import { estimatePlayerWage } from './economy.js';

export const CONTRACT_TERM = 'semester';
export const SEMESTER_MONTHS = 6;
export const RELEASE_FEE_FACTOR = 0.35;
export const RELEASE_FEE_ROUND_CAP_MONTHS = 6;

export const CONTRACT_ALERT_DAYS = Object.freeze([30, 7]);
export const RENEWAL_WINDOW_DAYS_BEFORE = 15;
export const RENEWAL_WINDOW_DAYS_AFTER = 7;

const MS_DAY = 86400000;

export const ROUNDS_PER_YEAR_BY_DIVISION = Object.freeze({ A: 38, B: 38, C: 38, D: 22 });

export function roundsPerYear(division = 'A') {
  return ROUNDS_PER_YEAR_BY_DIVISION[division] ?? 38;
}

/** Equivalente mensual para UI (≈ rodadas nacionais / 12). */
export function wageMonthlyFromRound(wagePerRound, division = 'A') {
  const w = Math.max(0, Number(wagePerRound) || 0);
  return Math.round((w * roundsPerYear(division)) / 12);
}

export function formatContractDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function addCalendarMonths(date, months) {
  const base = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(base.getTime())) return new Date();
  const out = new Date(base);
  out.setHours(12, 0, 0, 0);
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() !== day) out.setDate(0);
  return out;
}

export function calendarDaysBetween(from, to) {
  const a = from instanceof Date ? new Date(from) : new Date(from);
  const b = to instanceof Date ? new Date(to) : new Date(to);
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

export function normalizeContractAdjustment(raw) {
  const mode = ['none', 'fixed_pct', 'performance'].includes(raw?.mode) ? raw.mode : 'none';
  return {
    mode,
    ratePct: Math.max(0, Number(raw?.ratePct) || 0),
    performanceGate: raw?.performanceGate ?? null,
  };
}

export function buildPlayerContract({
  signedDate,
  wagePerRound,
  adjustment = null,
  status = 'active',
} = {}) {
  const signed = signedDate instanceof Date ? new Date(signedDate) : new Date(signedDate || Date.now());
  signed.setHours(12, 0, 0, 0);
  const expires = addCalendarMonths(signed, SEMESTER_MONTHS);
  const wage = Math.max(0, Math.round(Number(wagePerRound) || 0));
  return {
    signedDate: signed.toISOString().slice(0, 10),
    expiresDate: expires.toISOString().slice(0, 10),
    wagePerRound: wage,
    term: CONTRACT_TERM,
    status: status || 'active',
    adjustment: normalizeContractAdjustment(adjustment || { mode: 'none' }),
  };
}

export function syncPlayerWageFromContract(player) {
  if (!player?.contract) return player;
  const wage = Math.round(Number(player.contract.wagePerRound) || 0);
  if (wage > 0) player.wage = wage;
  const expYear = player.contract.expiresDate?.slice(0, 4);
  if (expYear) player.contractUntil = Number(expYear);
  return player;
}

/** Hidrata / migra save legado → contrato semestral. */
export function ensurePlayerContract(player, ctx = {}) {
  if (!player || typeof player !== 'object') return player;
  const division = ctx.division || 'A';
  const today = ctx.careerDate instanceof Date ? ctx.careerDate : new Date(ctx.careerDate || Date.now());
  today.setHours(12, 0, 0, 0);

  if (!player.contract || typeof player.contract !== 'object') {
    const wage =
      Number.isFinite(Number(player.wage)) && Number(player.wage) > 0
        ? Number(player.wage)
        : estimatePlayerWage(player, division);
    let signed = new Date(today);
    if (Number.isFinite(Number(ctx.season))) {
      signed = new Date(Number(ctx.season), 0, 1, 12, 0, 0, 0);
    }
    player.contract = buildPlayerContract({ signedDate: signed, wagePerRound: wage });
  } else {
    const c = player.contract;
    if (!c.signedDate || !c.expiresDate) {
      const wage = Math.round(Number(c.wagePerRound ?? player.wage) || estimatePlayerWage(player, division));
      player.contract = buildPlayerContract({ signedDate: today, wagePerRound: wage, adjustment: c.adjustment });
    } else {
      c.term = CONTRACT_TERM;
      c.wagePerRound = Math.round(Number(c.wagePerRound ?? player.wage) || estimatePlayerWage(player, division));
      c.adjustment = normalizeContractAdjustment(c.adjustment);
      c.status = c.status || 'active';
    }
  }

  refreshContractStatus(player, today);
  syncPlayerWageFromContract(player);
  return player;
}

export function contractExpiresDate(player) {
  const raw = player?.contract?.expiresDate;
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function refreshContractStatus(player, careerDate = new Date()) {
  if (!player?.contract) return 'active';
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  today.setHours(12, 0, 0, 0);
  const expires = contractExpiresDate(player);
  if (!expires) {
    player.contract.status = 'active';
    return 'active';
  }
  const daysLeft = calendarDaysBetween(today, expires);
  if (daysLeft < -RENEWAL_WINDOW_DAYS_AFTER) {
    player.contract.status = 'expired';
  } else if (daysLeft <= RENEWAL_WINDOW_DAYS_BEFORE) {
    player.contract.status = daysLeft < 0 ? 'expired' : 'expiring';
  } else {
    player.contract.status = 'active';
  }
  return player.contract.status;
}

export function isContractExpired(player, careerDate = new Date()) {
  refreshContractStatus(player, careerDate);
  return player?.contract?.status === 'expired';
}

export function isInRenewalWindow(player, careerDate = new Date()) {
  const expires = contractExpiresDate(player);
  if (!expires) return false;
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  const daysLeft = calendarDaysBetween(today, expires);
  return daysLeft <= RENEWAL_WINDOW_DAYS_BEFORE && daysLeft >= -RENEWAL_WINDOW_DAYS_AFTER;
}

export function estimateRoundsLeftInSemester(player, division, careerDate = new Date()) {
  const expires = contractExpiresDate(player);
  if (!expires) return 0;
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  const daysLeft = Math.max(0, calendarDaysBetween(today, expires));
  const semesterDays = SEMESTER_MONTHS * 30;
  const roundsInSemester = roundsPerYear(division) / 2;
  return Math.min(
    Math.ceil((daysLeft / semesterDays) * roundsInSemester),
    Math.ceil((RELEASE_FEE_ROUND_CAP_MONTHS / 12) * roundsPerYear(division)),
  );
}

/** Multa ao vender com contrato vigente; expirado = 0. */
export function computeReleaseFee(player, division = 'A', careerDate = new Date()) {
  if (!player?.contract) return 0;
  refreshContractStatus(player, careerDate);
  if (player.contract.status === 'expired') return 0;
  const wage = Math.round(Number(player.contract.wagePerRound ?? player.wage) || 0);
  if (wage <= 0) return 0;
  const roundsLeft = estimateRoundsLeftInSemester(player, division, careerDate);
  if (roundsLeft <= 0) return 0;
  return Math.round(wage * roundsLeft * RELEASE_FEE_FACTOR);
}

export function contractUiTone(player, careerDate = new Date()) {
  const status = refreshContractStatus(player, careerDate);
  if (status === 'expired') return 'expired';
  const expires = contractExpiresDate(player);
  if (!expires) return 'ok';
  const daysLeft = calendarDaysBetween(careerDate, expires);
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'warning';
  return 'ok';
}

/**
 * Pedido salarial na renovação.
 * Vigente → pede mais; expirado → aceita menos.
 */
export function computeRenewalWageAsk(player, division = 'A', ctx = {}) {
  const base = estimatePlayerWage(player, division);
  const current = Math.round(Number(player?.contract?.wagePerRound ?? player?.wage) || base);
  const expired = ctx.expired ?? isContractExpired(player, ctx.careerDate);
  const ovr = Number(player?.overall) || 60;
  const signedOvr = Number(ctx.signedOverall ?? ovr);
  let factor = expired ? 0.92 : 1.08;
  if (!expired && ovr >= signedOvr + 4) factor += 0.06;
  if (expired) factor = Math.min(factor, 1.0);
  const ask = Math.round(Math.max(base * 0.75, current * factor));
  return Math.max(estimatePlayerWage(player, division) * 0.7, ask);
}

export function signSemesterContract(player, {
  wagePerRound,
  signedDate,
  adjustment = null,
  division = 'A',
} = {}) {
  const wage =
    Math.round(Number(wagePerRound)) ||
    Math.round(Number(player?.wage)) ||
    estimatePlayerWage(player, division);
  player.contract = buildPlayerContract({
    signedDate: signedDate || new Date(),
    wagePerRound: wage,
    adjustment,
    status: 'active',
  });
  syncPlayerWageFromContract(player);
  return player;
}

export function applyRenewalClauseAsk(baseWage, adjustment) {
  const adj = normalizeContractAdjustment(adjustment);
  if (adj.mode === 'fixed_pct' && adj.ratePct > 0) {
    return Math.round(baseWage * (1 + adj.ratePct / 100));
  }
  return baseWage;
}

const contractAlertKey = (player, days) => `contract-alert-${player?.playerId || player?.name}-${days}`;

/** Alertas 30d/7d + fila de renovação (user). */
export function processClubContractCalendar({
  club,
  division = 'A',
  careerDate,
  pushMessage,
  currentRound = 1,
  pendingRenewals,
  alertedKeys,
  userClub = false,
} = {}) {
  if (!club?.roster?.length) return { pendingRenewals: pendingRenewals || [], alerts: 0 };
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  const pending = pendingRenewals || [];
  const keys = alertedKeys || new Set();
  let alerts = 0;

  club.roster.forEach(player => {
    ensurePlayerContract(player, { division, careerDate: today, season: today.getFullYear() });
    refreshContractStatus(player, today);
    const expires = contractExpiresDate(player);
    if (!expires) return;

    const daysLeft = calendarDaysBetween(today, expires);

    if (userClub) {
      for (const threshold of CONTRACT_ALERT_DAYS) {
        if (daysLeft > threshold || daysLeft < 0) continue;
        const key = contractAlertKey(player, threshold);
        if (keys.has(key)) continue;
        keys.add(key);
        alerts += 1;
        pushMessage?.({
          category: 'club',
          type: 'contract-alert',
          title: 'CONTRATO · Vencimento',
          body: `${player.name}: contrato vence em ${formatContractDate(expires)} (${daysLeft} dia${daysLeft === 1 ? '' : 's'}). Salário atual: R$ ${wageMonthlyFromRound(player.wage, division).toLocaleString('pt-BR')}/mês.`,
          round: currentRound,
          meta: {
            competition: 'Contratos',
            playerId: player.playerId,
            playerName: player.name,
            expiresDate: player.contract.expiresDate,
            daysLeft,
          },
        });
      }
    }

    if (!isInRenewalWindow(player, today)) return;

    const pid = player.playerId || player.name;
    if (pending.some(row => row.playerId === pid)) return;

    if (userClub) {
      const expired = daysLeft < 0;
      const wageAsk = computeRenewalWageAsk(player, division, { careerDate: today, expired });
      pending.push({
        playerId: pid,
        playerName: player.name,
        wageAsk,
        expired,
        expiresDate: player.contract.expiresDate,
      });
      pushMessage?.({
        category: 'club',
        type: 'contract-renewal',
        title: 'RENOVAÇÃO · Contrato semestral',
        body: `${player.name} ${expired ? 'está sem contrato vigente' : 'entra na janela de renovação'}. Pedido: R$ ${wageMonthlyFromRound(wageAsk, division).toLocaleString('pt-BR')}/mês (R$ ${wageAsk.toLocaleString('pt-BR')}/rod). Abra Elenco → Contratos ou responda pelo Escritório.`,
        round: currentRound,
        meta: {
          competition: 'Contratos',
          requiresAction: true,
          offerKind: 'contract-renewal',
          playerId: pid,
          playerName: player.name,
          wageAsk,
          expired,
        },
      });
      alerts += 1;
    }
  });

  return { pendingRenewals: pending, alerts, alertedKeys: keys };
}

/** Jogadores com contrato a vencer ou vencido — painel Elenco → Contratos. */
export function listRosterContractAlerts(roster, { division = 'A', careerDate = new Date() } = {}) {
  if (!Array.isArray(roster) || !roster.length) return [];
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  return roster
    .map(player => {
      ensurePlayerContract(player, { division, careerDate: today, season: today.getFullYear() });
      const status = refreshContractStatus(player, today);
      const tone = contractUiTone(player, today);
      if (tone === 'ok' && status !== 'expiring' && status !== 'expired') return null;
      const expires = contractExpiresDate(player);
      const daysLeft = expires ? calendarDaysBetween(today, expires) : null;
      const expired = status === 'expired' || (daysLeft != null && daysLeft < 0);
      const inRenewal =
        isInRenewalWindow(player, today) ||
        expired ||
        (daysLeft != null && daysLeft <= CONTRACT_ALERT_DAYS[0]);
      const wageAsk = computeRenewalWageAsk(player, division, { careerDate: today, expired });
      const wageCurrent = Math.round(Number(player.contract?.wagePerRound ?? player.wage) || 0);
      return {
        player,
        playerId: player.playerId || player.name,
        status,
        tone,
        expires,
        daysLeft,
        expired,
        inRenewal,
        wageAsk,
        wageCurrent,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.expired && !b.expired) return -1;
      if (b.expired && !a.expired) return 1;
      const da = a.daysLeft ?? 999;
      const db = b.daysLeft ?? 999;
      return da - db;
    });
}

/** IA: renova titulares prováveis; libera reservas caras expiradas. */
export function processAiClubContractsSilent(club, division = 'A', careerDate = new Date(), random = Math.random) {
  if (!club?.roster?.length) return;
  const today = careerDate instanceof Date ? careerDate : new Date(careerDate);
  club.roster.forEach(player => {
    ensurePlayerContract(player, { division, careerDate: today });
    if (!isInRenewalWindow(player, today) && !isContractExpired(player, today)) return;

    const starter = !!player.starter;
    const ovr = Number(player.overall) || 0;
    const renewRoll = typeof random === 'function' ? random() : Math.random();
    const shouldRenew = starter || ovr >= 72 || renewRoll < 0.55;

    if (shouldRenew) {
      const expired = isContractExpired(player, today);
      const ask = computeRenewalWageAsk(player, division, { careerDate: today, expired });
      const wage = expired ? Math.round(ask * 0.95) : Math.round(ask * 1.02);
      signSemesterContract(player, {
        wagePerRound: applyRenewalClauseAsk(wage, player.contract?.adjustment),
        signedDate: today,
        adjustment: player.contract?.adjustment,
        division,
      });
    } else if (isContractExpired(player, today)) {
      player.contract.status = 'expired';
    }
  });
}
