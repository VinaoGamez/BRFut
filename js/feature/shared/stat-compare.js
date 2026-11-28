/**
 * Linha de estatística em barras (mandante × visitante), padrão do pós-jogo.
 * Usada no pós-jogo e nas estatísticas ao vivo para que o mesmo dado tenha
 * sempre o mesmo visual.
 */
const num = value => Number(String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

export function statCompareRow([label, homeValue, awayValue, kind = '']) {
  const hv = num(homeValue);
  const av = num(awayValue);
  const total = hv + av;
  const hShare = total ? (hv / total) * 100 : 50;
  const lead = hv === av ? 'even' : hv > av ? 'home' : 'away';
  return `<div class="stat pm2-cmp${kind ? ` is-${kind}` : ''}" data-lead="${lead}"><strong class="pm2-cmp-home">${homeValue}</strong><span class="pm2-cmp-mid"><small>${label}</small><i class="pm2-cmp-bar"><b class="is-home" style="width:${hShare}%"></b><b class="is-away" style="width:${100 - hShare}%"></b></i></span><strong class="pm2-cmp-away">${awayValue}</strong></div>`;
}
