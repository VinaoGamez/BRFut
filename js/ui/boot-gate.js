/** Oculta placeholders do index.html até refreshSeasonPresentation + bootEngine concluírem. */
export function markBootReady() {
  if (document.documentElement.dataset.boot === 'ready') return;
  document.documentElement.dataset.boot = 'ready';
  document.getElementById('bootSplash')?.remove();
}
