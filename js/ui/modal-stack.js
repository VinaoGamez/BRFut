/**
 * Pilha de pop-ups: o último pop-up aberto fica sempre na frente.
 *
 * Os modais nascem com z-index fixo no CSS; quando um abre por cima de outro
 * (ex.: ficha do jogador a partir do elenco de um clube), o mais novo podia
 * ficar escondido atrás. Aqui cada modal que fica visível recebe um z-index
 * acima de todos os já abertos, e perde o valor ao fechar.
 */

const SELECTOR = '.modal, .nto-modal';
/** Base acima do cabeçalho e da navegação do celular, abaixo dos alertas globais (99990+). */
export const MODAL_STACK_BASE = 2300;
/** A partida ao vivo mantém a própria camada; o que abre por cima dela entra na pilha. */
const EXCLUDED = new Set(['matchModal']);

export function isModalOpen(el) {
  return !!el && !el.hidden && !el.classList.contains('hidden');
}

/** Próximo z-index dado o estado atual (função pura para testes). */
export function nextStackIndex(openIndexes, base = MODAL_STACK_BASE) {
  const top = openIndexes.reduce((max, z) => (Number.isFinite(z) && z > max ? z : max), base - 1);
  return top + 1;
}

export function installModalStack(root = document) {
  if (typeof MutationObserver === 'undefined' || !root?.body) return () => {};
  const openIndexes = () => [...root.querySelectorAll(SELECTOR)]
    .filter(m => m.dataset.stackZ && isModalOpen(m))
    .map(m => Number(m.dataset.stackZ));

  const sync = el => {
    if (!el?.matches?.(SELECTOR) || EXCLUDED.has(el.id)) return;
    if (isModalOpen(el)) {
      if (el.dataset.stackZ) return;
      const z = nextStackIndex(openIndexes());
      el.dataset.stackZ = String(z);
      el.style.setProperty('z-index', String(z), 'important');
    } else if (el.dataset.stackZ) {
      delete el.dataset.stackZ;
      el.style.removeProperty('z-index');
    }
  };

  const observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes') sync(r.target);
      else r.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        sync(n);
        n.querySelectorAll?.(SELECTOR).forEach(sync);
      });
    }
  });
  observer.observe(root.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  root.querySelectorAll(SELECTOR).forEach(sync);
  return () => observer.disconnect();
}
