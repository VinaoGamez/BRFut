/**
 * Escudo unificado — clubes (SVG), seleções (bandeira) ou iniciais (fallback).
 */

import {
  isNationalTeam,
  nationalTeamFlagUrlForTeam,
  resolveNationalTeam,
} from '../engine/national-teams.js';
import { clubStyleInitials, resolveClubCrest, buildClubCrestDataUrl } from '../engine/club-crests.js';
import { humanBadgeHtml } from './human-badge.js';

export { clubStyleInitials };

export function teamCrestLabel(teamKey) {
  const nt = resolveNationalTeam(teamKey);
  if (nt) return nt.name;
  const crest = resolveClubCrest(teamKey);
  return crest?.name || String(teamKey || '');
}

export function teamUsesFlagCrest(teamKey) {
  return isNationalTeam(teamKey);
}

export function teamUsesClubCrest(teamKey) {
  return !isNationalTeam(teamKey) && !!resolveClubCrest(teamKey);
}

function applyClubCrestImage(el, src, label) {
  el.classList.add('crest--club');
  el.classList.remove('crest--flag');
  el.textContent = '';
  el.title = label;
  el.setAttribute('aria-label', label);
  let img = el.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    el.appendChild(img);
  }
  const fallback = buildClubCrestDataUrl(label);
  img.onerror = () => {
    img.onerror = null;
    if (img.src !== fallback) img.src = fallback;
  };
  if (src) img.src = src;
}

/** Atualiza elemento `.crest` existente (placar ao vivo). */
export function applyTeamCrestToElement(el, teamKey, { away = false } = {}) {
  if (!el) return;
  el.classList.toggle('away', !!away);
  const nt = resolveNationalTeam(teamKey);
  if (nt) {
    const src = nationalTeamFlagUrlForTeam(nt.code);
    el.classList.add('crest--flag');
    el.classList.remove('crest--club');
    el.textContent = '';
    el.title = nt.name;
    el.setAttribute('aria-label', nt.name);
    let img = el.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      el.appendChild(img);
    }
    if (src) img.src = src;
    return;
  }
  const crest = resolveClubCrest(teamKey);
  if (crest?.url) {
    applyClubCrestImage(el, crest.url, crest.name);
    return;
  }
  el.classList.remove('crest--flag', 'crest--club');
  el.querySelector('img')?.remove();
  const label = String(teamKey || '');
  el.textContent = clubStyleInitials(label);
  el.title = label;
  el.setAttribute('aria-label', label);
}

/**
 * HTML do escudo — bandeira (seleção), SVG de clube ou iniciais.
 */
export function teamCrestHtml(teamKey, { away = false, className = '', title = '' } = {}) {
  const nt = resolveNationalTeam(teamKey);
  const label = title || teamCrestLabel(teamKey);

  if (nt) {
    const src = nationalTeamFlagUrlForTeam(nt.code);
    const crestClass = ['crest', away ? 'away' : '', className, 'crest--flag'].filter(Boolean).join(' ');
    if (src) {
      return `<i class="${crestClass}" title="${label}" aria-label="${label}"><img src="${src}" alt="" loading="lazy" decoding="async"></i>`;
    }
  }

  const crest = resolveClubCrest(teamKey);
  if (crest?.url) {
    const crestClass = ['crest', away ? 'away' : '', className, 'crest--club'].filter(Boolean).join(' ');
    return `<i class="${crestClass}" title="${label}" aria-label="${label}"><img src="${crest.url}" alt="" loading="lazy" decoding="async"></i>`;
  }

  const initials = clubStyleInitials(teamKey);
  const crestClass = ['crest', away ? 'away' : '', className].filter(Boolean).join(' ');
  return `<i class="${crestClass}" title="${label}" aria-label="${label}">${initials}</i>`;
}

/** Escudo + badge treinador humano. */
export function teamCrestWithHumanHtml(teamKey, { isHuman = false, away = false, className = '' } = {}) {
  const crest = teamCrestHtml(teamKey, { away, className });
  if (!isHuman) return crest;
  return `<span class="human-badge-host has-human">${crest}${humanBadgeHtml({ className: 'is-crest' })}</span>`;
}

/** Compat — alias usado pelo motor legado. */
export const clubCrestInitials = clubStyleInitials;
