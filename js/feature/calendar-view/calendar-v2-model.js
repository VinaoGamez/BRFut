/**
 * Regras puras do Calendário v2 (sem DOM), testadas em
 * scripts/calendar-v2-tests.mjs.
 */
export const dayDiff = (a, b) =>
  Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000,
  );

/** Cor da competição pelo código da tag (mesmo código de cor das tags). */
export const competitionColor = code => {
  if (!code) return 'var(--av-muted)';
  if (/^BS[ABCD]$/.test(code)) return 'var(--av-cyan)';
  if (code === 'EST') return 'var(--av-green)';
  if (code === 'CBR') return 'var(--av-orange)';
  if (code === 'CSU') return 'var(--av-red)';
  return 'var(--av-gold)';
};

/** Placar do ponto de vista do clube: { outcome: V|E|D, mine, theirs }. */
export const userOutcome = (label, atHome) => {
  const nums = String(label || '').match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  const home = Number(nums[0]);
  const away = Number(nums[1]);
  const mine = atHome ? home : away;
  const theirs = atHome ? away : home;
  let outcome = mine > theirs ? 'V' : mine < theirs ? 'D' : 'E';
  // Mata-mata decidido nos pênaltis: "1—1 (4—3 pên.)".
  if (outcome === 'E' && nums.length >= 4) {
    const penHome = Number(nums[2]);
    const penAway = Number(nums[3]);
    const penMine = atHome ? penHome : penAway;
    const penTheirs = atHome ? penAway : penHome;
    if (penMine !== penTheirs) outcome = penMine > penTheirs ? 'V' : 'D';
  }
  return { outcome, mine, theirs };
};

/** Carga da semana pela quantidade de jogos do clube. */
export const weekLoad = gameDates => {
  const count = gameDates.length;
  if (!count) return { level: 'rest', label: 'Sem jogos · semana de treino', pct: 15 };
  if (count === 1) return { level: 'ok', label: '1 jogo · carga normal', pct: 45 };
  const sorted = [...gameDates].sort((a, b) => a - b);
  const span = dayDiff(sorted[0], sorted[sorted.length - 1]) + 1;
  return {
    level: 'high',
    label: `${count} jogos em ${span} dias · carga alta`,
    pct: Math.min(100, 60 + count * 12),
  };
};

