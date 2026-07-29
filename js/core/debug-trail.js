/** Trilha curta no sessionStorage — visível no DevTools em produção (brfut.com.br). */
const DEBUG_TRAIL_KEY = 'matchday-debug-trail';

export function appendDebugTrail(event, data = {}) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(DEBUG_TRAIL_KEY) || '[]');
    prev.push({ event, ...data, ts: Date.now() });
    sessionStorage.setItem(DEBUG_TRAIL_KEY, JSON.stringify(prev.slice(-24)));
  } catch {
    /* ignore */
  }
}
