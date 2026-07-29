const loaders = {
  nacional: () => import('../../assets/competitions/trophies/trophy-nacional.webp'),
  'copa-nacional': () => import('../../assets/competitions/trophies/trophy-copa-nacional.webp'),
  'recopa-nacional': () => import('../../assets/competitions/trophies/trophy-recopa-nacional.webp'),
  estaduais: () => import('../../assets/competitions/trophies/trophy-estaduais.webp'),
  libertadores: () => import('../../assets/competitions/trophies/trophy-libertadores.webp'),
  'sul-americana': () => import('../../assets/competitions/trophies/trophy-sul-americana.webp'),
  'world-cup': () => import('../../assets/competitions/trophies/trophy-world-cup.png'),
};

const cache = new Map();

export const COMPETITION_TROPHY_ASSETS = Object.fromEntries(
  Object.keys(loaders).map(key => [key, { id: key, label: key, url: null }]),
);

/** Chave visual do troféu para a página Campeonatos. */
export function resolveChampionshipTrophyKey(pageCompetition) {
  const id = String(pageCompetition || '').toUpperCase();
  if (id === 'CUP') return 'copa-nacional';
  if (id === 'RECOPA') return 'recopa-nacional';
  if (id === 'ESTADUAIS' || id.startsWith('EST:')) return 'estaduais';
  if (id === 'LIBERTADORES' || id === 'LIB') return 'libertadores';
  if (id === 'SUDAMERICANA' || id === 'SUD') return 'sul-americana';
  if (id === 'CMU' || id === 'WORLD_CUP') return 'world-cup';
  return 'nacional';
}

export async function preloadCompetitionTrophy(key = 'nacional') {
  const resolved = loaders[key] ? key : 'nacional';
  if (cache.has(resolved)) return cache.get(resolved);
  const mod = await loaders[resolved]();
  const url = mod.default;
  cache.set(resolved, url);
  if (COMPETITION_TROPHY_ASSETS[resolved]) COMPETITION_TROPHY_ASSETS[resolved].url = url;
  return url;
}

export function competitionTrophyUrl(pageCompetition) {
  const key = resolveChampionshipTrophyKey(pageCompetition);
  return cache.get(key) || cache.get('nacional') || '';
}

export function ensureCompetitionTrophy(pageCompetition, imgEl) {
  const key = resolveChampionshipTrophyKey(pageCompetition);
  const apply = url => {
    if (imgEl && url && imgEl.getAttribute('src') !== url) imgEl.setAttribute('src', url);
  };
  const cached = cache.get(key);
  if (cached) {
    apply(cached);
    return Promise.resolve(cached);
  }
  return preloadCompetitionTrophy(key).then(url => {
    apply(url);
    return url;
  });
}

export function hydratePickerTrophyIcons(root = document) {
  root.querySelectorAll('[data-trophy-key]').forEach(async slot => {
    const key = slot.dataset.trophyKey || 'nacional';
    if (slot.querySelector('img')) return;
    const url = await preloadCompetitionTrophy(key);
    const img = document.createElement('img');
    img.className = 'championship-page-picker-trophy';
    img.alt = '';
    img.width = 22;
    img.height = 22;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = url;
    slot.prepend(img);
  });
}

