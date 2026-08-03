const STORAGE_KEY = 'brfut-manager-card-layout-v1';

export const DEFAULT_MANAGER_CARD_LAYOUT = Object.freeze({
  artX: 50,
  artY: 50,
  artScale: 1,
  infoLeft: 32,
  infoRight: 32,
  infoBottom: 20,
  clubWidth: 106,
  nameSize: 43,
  crestSize: 54,
  backPadX: 32,
  backPadY: 32,
  backNameSize: 37,
  sectionGap: 18,
  radius: 28,
});

const numericKeys = Object.keys(DEFAULT_MANAGER_CARD_LAYOUT);

export function normalizeManagerCardLayout(raw = {}) {
  const layout = {};
  numericKeys.forEach(key => {
    const fallback = DEFAULT_MANAGER_CARD_LAYOUT[key];
    const value = Number(raw?.[key]);
    layout[key] = Number.isFinite(value) ? value : fallback;
  });
  return layout;
}

export function loadManagerCardLayout() {
  try {
    return normalizeManagerCardLayout(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return normalizeManagerCardLayout();
  }
}

export function saveManagerCardLayout(layout) {
  const normalized = normalizeManagerCardLayout(layout);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* ignore */ }
  return normalized;
}

export function resetManagerCardLayout() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return normalizeManagerCardLayout();
}

export function managerCardLayoutStyle(layout = loadManagerCardLayout()) {
  const value = normalizeManagerCardLayout(layout);
  return [
    `--manager-art-x:${value.artX}%`,
    `--manager-art-y:${value.artY}%`,
    `--manager-art-scale:${value.artScale}`,
    `--manager-info-left:${value.infoLeft}px`,
    `--manager-info-right:${value.infoRight}px`,
    `--manager-info-bottom:${value.infoBottom}px`,
    `--manager-club-width:${value.clubWidth}px`,
    `--manager-name-size:${value.nameSize}px`,
    `--manager-crest-size:${value.crestSize}px`,
    `--manager-back-pad-x:${value.backPadX}px`,
    `--manager-back-pad-y:${value.backPadY}px`,
    `--manager-back-name-size:${value.backNameSize}px`,
    `--manager-section-gap:${value.sectionGap}px`,
    `--manager-card-radius:${value.radius}px`,
  ].join(';');
}

export function managerCardLayoutExport(layout) {
  return { type: 'brfut-manager-card-layout', version: 1, layout: normalizeManagerCardLayout(layout) };
}
