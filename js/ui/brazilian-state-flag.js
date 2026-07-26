/**
 * Bandeiras oficiais dos 27 estados — PNG 200px em public/state-flags/ (CC0).
 * Exibição ~56px na UI; 200px mantém nitidez sem decodificar 800px na RAM.
 * Fonte: https://github.com/pierrelapalu/icones-bandeiras-br-uf
 */

const STATE_FLAG_BASE = './state-flags';

/**
 * URL da bandeira PNG do estado.
 * @param {string} ufCode
 */
export function stateFlagUrl(ufCode) {
  const code = String(ufCode || '').toUpperCase();
  return `${STATE_FLAG_BASE}/${code.toLowerCase()}.png`;
}

/**
 * Markup da bandeira do estado.
 * @param {string} ufCode
 * @param {{ className?: string }} [opts]
 */
export function stateFlagMarkup(ufCode, { className = 'state-flag' } = {}) {
  const code = String(ufCode || '').toUpperCase();
  const url = stateFlagUrl(code);
  return `<span class="${className}" data-uf="${code}"><img class="state-flag-img" src="${url}" alt="" aria-hidden="true" loading="lazy" decoding="async" fetchpriority="low" width="200" height="133"/></span>`;
}
