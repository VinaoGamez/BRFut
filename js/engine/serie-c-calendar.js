/**
 * Calendário de tamanho da Série C (espelho CBF 2026→2028).
 * 2026: 20 | 2027: 24 | 2028+: 28.
 *
 * O rebaixamento acompanha o tamanho da divisão: 20 clubes → Z2, 24 → Z4,
 * 28 → Z6. A regra exibida e a executada precisam sair daqui — antes o valor
 * era uma constante fixa de 4, que não fechava nem com o tamanho da divisão
 * nem com a Série D (que promove 6).
 */

export const SERIE_D_CLUBS = 96;
export const SERIE_D_GROUPS = 16;
export const SERIE_D_PROMOTIONS = 6;

/** @deprecated Use serieCRelegationSlots(temporada) — o valor depende do tamanho. */
export const SERIE_C_RELEGATION_TO_D = 4;

/** Quantidade de clubes da Série C na temporada indicada. */
export function serieCClubsForSeason(season) {
  const year = Number(season) || 2026;
  if (year <= 2026) return 20;
  if (year === 2027) return 24;
  return 28;
}

/** Maior tamanho que a Série C alcança no formato CBF. */
export const SERIE_C_MAX_CLUBS = 28;

/**
 * Zonas de rebaixamento para a Série D na tabela da Série C.
 *
 * A CBF fixa a vaga garantida na Série D por temporada, e ela acompanha o
 * tamanho da divisão. Ceder 2 vagas com 20 clubes, 4 com 24 e 6 com 28.
 *
 * @param {number} [season] temporada; sem argumento assume a temporada atual
 * @returns {number} quantos clubes são rebaixados
 */
export function serieCRelegationSlots(season) {
  const clubs = serieCClubsForSeason(season);
  return Math.max(2, Math.round(clubs / 2 - 8));
}

/** @deprecated Use serieCRelegationSlots(temporada) — mantido por compatibilidade. */
export function serieCRelegationCountForTransition(_currentSize, nextSeason) {
  return serieCRelegationSlots(nextSeason);
}

/**
 * Corrige listas C/D para o tamanho da temporada (saves inflados / gerados).
 * @returns {{ divisionTeams: {A:string[],B:string[],C:string[],D:string[]}, changed: boolean, target: number }}
 */
export function normalizeDivisionTeamsSerieC(divisionTeams, options = {}) {
  const season = options.season;
  const userClub = options.userClub || null;
  const fillPool = Array.isArray(options.fillPool) ? options.fillPool : [];
  const skipD = options.skipD === true;
  const dTarget = Number(options.dTarget) > 0 ? Number(options.dTarget) : SERIE_D_CLUBS;
  const target = serieCClubsForSeason(season);

  const next = {
    A: [...(divisionTeams?.A || [])],
    B: [...(divisionTeams?.B || [])],
    C: [...(divisionTeams?.C || [])],
    D: [...(divisionTeams?.D || [])],
  };
  let changed = false;

  if (next.C.length > target) {
    const keep = [];
    if (userClub && next.C.includes(userClub)) keep.push(userClub);
    for (const name of next.C) {
      if (keep.length >= target) break;
      if (!keep.includes(name)) keep.push(name);
    }
    const demoted = next.C.filter(name => !keep.includes(name));
    next.C = keep;
    next.D.push(...demoted);
    changed = true;
  } else if (next.C.length < target) {
    const need = target - next.C.length;
    const promote = [];
    for (const name of next.D) {
      if (promote.length >= need) break;
      if (name === userClub) continue;
      promote.push(name);
    }
    if (promote.length < need) {
      for (const name of next.D) {
        if (promote.length >= need) break;
        if (!promote.includes(name)) promote.push(name);
      }
    }
    if (promote.length) {
      next.C.push(...promote);
      const promoted = new Set(promote);
      next.D = next.D.filter(name => !promoted.has(name));
      changed = true;
    }
  }

  const used = new Set([...next.A, ...next.B, ...next.C, ...next.D]);
  if (!skipD) {
    if (next.D.length > dTarget) {
      while (next.D.length > dTarget) {
        let idx = -1;
        for (let i = next.D.length - 1; i >= 0; i -= 1) {
          if (next.D[i] !== userClub) {
            idx = i;
            break;
          }
        }
        if (idx < 0) break;
        next.D.splice(idx, 1);
        changed = true;
      }
    } else if (next.D.length < dTarget) {
      for (const name of fillPool) {
        if (next.D.length >= dTarget) break;
        if (!name || used.has(name)) continue;
        next.D.push(name);
        used.add(name);
        changed = true;
      }
    }
  }

  return { divisionTeams: next, changed, target };
}
