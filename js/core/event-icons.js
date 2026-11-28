/**
 * Ícones de lance únicos do jogo (Arcade Noturno v2).
 * Toda tela que mostra gol, cartão, substituição, lesão etc. usa este conjunto,
 * para o mesmo lance ter sempre o mesmo visual.
 */
import goalUrl from '../../assets/ui/icons/goal.webp?url';
import ownGoalUrl from '../../assets/ui/icons/own-goal.webp?url';
import penaltyGoalUrl from '../../assets/ui/icons/penalty-goal.webp?url';
import penaltyMissUrl from '../../assets/ui/icons/penalty-miss.webp?url';
import assistUrl from '../../assets/ui/icons/assist.webp?url';
import yellowUrl from '../../assets/ui/icons/yellow.webp?url';
import redUrl from '../../assets/ui/icons/red.webp?url';
import secondYellowUrl from '../../assets/ui/icons/second-yellow.webp?url';
import subUrl from '../../assets/ui/icons/sub.webp?url';
import subInUrl from '../../assets/ui/icons/sub-in.webp?url';
import subOutUrl from '../../assets/ui/icons/sub-out.webp?url';
import injuryUrl from '../../assets/ui/icons/injury.webp?url';
import knockUrl from '../../assets/ui/icons/knock.webp?url';
import suspendedUrl from '../../assets/ui/icons/suspended.webp?url';
import motmUrl from '../../assets/ui/icons/motm.webp?url';
import captainUrl from '../../assets/ui/icons/captain.webp?url';

export const EVENT_ICONS = {
  goal: { url: goalUrl, label: 'Gol' },
  'own-goal': { url: ownGoalUrl, label: 'Gol contra' },
  'penalty-goal': { url: penaltyGoalUrl, label: 'Gol de pênalti' },
  'penalty-miss': { url: penaltyMissUrl, label: 'Pênalti perdido' },
  assist: { url: assistUrl, label: 'Assistência' },
  yellow: { url: yellowUrl, label: 'Cartão amarelo' },
  red: { url: redUrl, label: 'Cartão vermelho' },
  'second-yellow': { url: secondYellowUrl, label: 'Segundo amarelo' },
  substitution: { url: subUrl, label: 'Substituição' },
  'sub-in': { url: subInUrl, label: 'Entrou' },
  'sub-out': { url: subOutUrl, label: 'Saiu' },
  injury: { url: injuryUrl, label: 'Lesão' },
  knock: { url: knockUrl, label: 'Incômodo físico' },
  suspended: { url: suspendedUrl, label: 'Suspenso' },
  motm: { url: motmUrl, label: 'Craque do jogo' },
  captain: { url: captainUrl, label: 'Capitão' },
};

/** Tamanhos padrão: lista/elenco 16 · relatório/lances 20 · gráfico 22. */
export const EVENT_ICON_SIZE = { list: 16, report: 20, chart: 22 };

export const eventIconUrl = kind => EVENT_ICONS[kind]?.url || '';
export const eventIconLabel = kind => EVENT_ICONS[kind]?.label || '';

const escAttr = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/**
 * <img> do ícone. `attrs` entra cru (ex.: data-tip já escapado).
 */
export const eventIconHtml = (kind, { size = EVENT_ICON_SIZE.report, className = '', label, attrs = '' } = {}) => {
  const icon = EVENT_ICONS[kind];
  if (!icon) return '';
  const alt = escAttr(label || icon.label);
  return `<img class="bf-ev-icon${className ? ` ${className}` : ''}" data-ev="${kind}" src="${icon.url}" width="${size}" height="${size}" alt="${alt}" draggable="false" ${attrs}/>`;
};

/** <image> para usar dentro de SVG (centro em 0,0). */
export const eventIconSvg = (kind, size = EVENT_ICON_SIZE.chart) => {
  const url = eventIconUrl(kind);
  if (!url) return '';
  const h = size / 2;
  return `<image href="${url}" xlink:href="${url}" x="${-h}" y="${-h}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
};
