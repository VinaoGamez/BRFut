// Display only: never write these labels back to the player or save.
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'y', 'del', 'la', 'las', 'los', 'el', 'van', 'von', 'der', 'den', 'di', 'du', 'des', 'le']);
const key = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const parts = name => String(name || '').split(/\s+/).filter(p => p && !PARTICLES.has(p.toLowerCase()));

export function abbreviatePlayerName(name) {
  const p = parts(name);
  return p.length <= 2 ? p.join(' ') : `${p[0]} ${p.slice(1, -1).map(s => `${s[0]}.`).join(' ')} ${p.at(-1)}`;
}

export function abbreviateRosterNames(names) {
  // Reserve ALL full names first, including players rendered later.
  const reserved = new Set(names.map(key));
  const used = new Set();
  return names.map(name => {
    const p = parts(name);
    const candidates = [abbreviatePlayerName(name)];
    if (p.length > 2) candidates.push(`${p[0][0]}. ${p.slice(1).join(' ')}`);
    const label = candidates.find(candidate => candidate.length <= name.length && !used.has(key(candidate)) &&
      (key(candidate) === key(name) || !reserved.has(key(candidate)))) || name;
    used.add(key(label));
    return label;
  });
}

export function playerDisplayName(name, roster = []) {
  const names = roster.map(player => typeof player === 'string' ? player : player?.name || '');
  const index = names.indexOf(name);
  // Without a known context, keep the full name rather than risk ambiguity.
  return index < 0 ? name : abbreviateRosterNames(names)[index];
}
