/**
 * Peças visuais da Retrospectiva (Etapa 3) — usadas no pop-up de fim de
 * temporada e no card "temporada encerrada" da Central.
 */
import { formatBudget } from '../../engine/economy.js';

export const money = value => formatBudget(Number(value) || 0);

export const esc = value =>
  String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

const TONE_CLASS = { good: 'is-good', mid: 'is-mid', bad: 'is-bad' };

/** Uma competição: nome colorido, resultado grande e detalhe. */
export function retroCompCard(comp, { compact = false } = {}) {
  if (!comp) return '';
  return `<article class="retro-comp ${TONE_CLASS[comp.tone] || 'is-mid'} c-${esc(comp.color || 'cyan')}${compact ? ' is-compact' : ''}">
    <span class="retro-comp-name">${esc(comp.name)}</span>
    <strong class="retro-comp-result">${esc(comp.result)}</strong>
    <small class="retro-comp-detail">${esc(comp.detail)}</small>
  </article>`;
}

/** Tile genérico (rótulo / valor / detalhe). */
export function retroTile(label, value, detail = '', tone = '') {
  return `<article class="retro-tile${tone ? ` t-${tone}` : ''}">
    <span>${esc(label)}</span>
    <strong>${esc(value)}</strong>
    ${detail ? `<small>${esc(detail)}</small>` : '<small>&nbsp;</small>'}
  </article>`;
}

export function goalStatusText(goal) {
  if (!goal?.status) return '';
  const label = { exceeded: 'Meta superada', met: 'Meta cumprida', near: 'Meta quase cumprida', missed: 'Meta não cumprida' }[goal.status] || 'Meta avaliada';
  return goal.label ? `${label}: ${goal.label.charAt(0).toLowerCase()}${goal.label.slice(1)}` : label;
}

export function shortPlayerName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '—';
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

export function ratingText(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1).replace('.', ',') : '—';
}
