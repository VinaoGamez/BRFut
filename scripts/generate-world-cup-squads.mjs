/**
 * Gera data/world-cup-2026-squads.json — 48 seleções × 26 jogadores.
 * Uso: node scripts/generate-world-cup-squads.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIONAL_TEAMS, nationalTeamPower } from '../js/engine/national-teams.js';
import { rollPlayerName, dedupeRosterNames } from '../js/engine/player-names.js';
import { rollNationalTeamPlayerAge } from '../js/engine/national-team-player.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'public', 'data', 'world-cup-2026-squads.json');

/** Eco-nomes craque (24) — chave = código seleção. */
const CRAQUE_ROSTER = {
  ARG: [{ name: 'Leonel Messi', pos: 'ATA' }, { name: 'Enzo Fernandes', pos: 'MEI' }],
  POR: [{ name: 'Cristovão Rinaldo', pos: 'ATA' }, { name: 'Bernardo Sylva', pos: 'MEI' }],
  FRA: [
    { name: 'Kylian Mbappo', pos: 'ATA' },
    { name: 'Michel Olisse', pos: 'PE' },
    { name: 'Osmar Dembélé', pos: 'PD' },
  ],
  NOR: [{ name: 'Erling Ralland', pos: 'ATA' }],
  BRA: [{ name: 'Neimar', pos: 'ATA' }, { name: 'Vinicius Júnior', pos: 'PE' }],
  CRO: [{ name: 'Luca Modritch', pos: 'MEI' }],
  ENG: [{ name: 'Harry Kaine', pos: 'ATA' }, { name: 'Jude Bellinga', pos: 'MEI' }],
  BEL: [{ name: 'Kevin de Bruno', pos: 'MEI' }],
  EGY: [{ name: 'Mohamed Sala', pos: 'PE' }],
  KOR: [{ name: 'Sun Heung-min', pos: 'PE' }],
  ESP: [
    { name: 'Rodrygo Hernández', pos: 'PE' },
    { name: 'Lamin Yamal', pos: 'PD' },
  ],
  GER: [{ name: 'Florian Virtz', pos: 'MEI' }],
  NED: [{ name: 'Virgil Van Dyk', pos: 'ZAG' }],
  COL: [{ name: 'Luz Dias', pos: 'PE' }],
  URU: [{ name: 'Frederico Valverde', pos: 'MEI' }],
  SEN: [{ name: 'Sódio Mané', pos: 'PE' }],
  MAR: [{ name: 'Assaf Hakimi', pos: 'LAT' }],
};

/** Destaques prata — contagem numérica ou lista { name, pos } (eco-nomes + posição real). */
const DESTAQUE_NAMES = {
  BRA: [
    { name: 'Rafinha', pos: 'PE' },
    { name: 'Marquinhos', pos: 'ZAG' },
  ],
  ARG: [
    { name: 'Julián Di María', pos: 'PE' },
    { name: 'Lautaro Martínez', pos: 'ATA' },
  ],
  POR: [
    { name: 'Rúben Dias', pos: 'ZAG' },
    { name: 'Diogo Jota', pos: 'ATA' },
  ],
  NED: [
    { name: 'Memphis Depay', pos: 'ATA' },
    { name: 'Cody Gakpo', pos: 'PE' },
    { name: 'Jeremie Frimpong', pos: 'LAT' },
  ],
  ENG: [{ name: 'Bukayo Saka', pos: 'PD' }],
  ESP: [{ name: 'Álvaro Morata', pos: 'ATA' }],
  BEL: [
    { name: 'Romelu Lukaku', pos: 'ATA' },
    { name: 'Jan Vertonghen', pos: 'ZAG' },
  ],
  GER: [
    { name: 'Joshua Kimmich', pos: 'LAT' },
    { name: 'Jamal Musiala', pos: 'MEI' },
  ],
  CRO: [
    { name: 'Marcelo Brozović', pos: 'MEI' },
    { name: 'Dejan Lovren', pos: 'ZAG' },
  ],
  MAR: [
    { name: 'Hakim Ziyech', pos: 'MEI' },
    { name: 'Sofyan Amrabat', pos: 'VOL' },
  ],
  COL: [{ name: 'James Rodríguez', pos: 'MEI' }],
  URU: [
    { name: 'Luis Suárez', pos: 'ATA' },
    { name: 'Darwin Núñez', pos: 'ATA' },
  ],
  SUI: [
    { name: 'Granit Xhaka', pos: 'MEI' },
    { name: 'Manuel Akanji', pos: 'ZAG' },
    { name: 'Yann Sommer', pos: 'GOL' },
  ],
  JPN: [
    { name: 'Takefusa Kubo', pos: 'PE' },
    { name: 'Kaoru Mitoma', pos: 'PE' },
  ],
  SEN: [
    { name: 'Kalidou Koulibaly', pos: 'ZAG' },
    { name: 'Idrissa Gueye', pos: 'VOL' },
    { name: 'Édouard Mendy', pos: 'GOL' },
  ],
  USA: [
    { name: 'Christian Pulisic', pos: 'PE' },
    { name: 'Giovanni Reyna', pos: 'MEI' },
  ],
  MEX: [{ name: 'Hirving Lozano', pos: 'PE' }],
  ECU: [
    { name: 'Moisés Caicedo', pos: 'VOL' },
    { name: 'Enner Valencia', pos: 'ATA' },
  ],
  AUT: [
    { name: 'David Alaba', pos: 'LAT' },
    { name: 'Marcel Sabitzer', pos: 'MEI' },
  ],
  KOR: [{ name: 'Lee Kang-in', pos: 'MEI' }],
  AUS: [{ name: 'Mathew Ryan', pos: 'GOL' }],
  NOR: [
    { name: 'Martin Ødegaard', pos: 'MEI' },
    { name: 'Rasmus Højlund', pos: 'ATA' },
  ],
  EGY: [{ name: 'Omar Marmoush', pos: 'ATA' }],
  CAN: [
    { name: 'Alphonso Davies', pos: 'LAT' },
    { name: 'Jonathan David', pos: 'ATA' },
  ],
  SWE: [
    { name: 'Alexander Isak', pos: 'ATA' },
    { name: 'Emil Forsberg', pos: 'MEI' },
  ],
  CIV: [
    { name: 'Wilfried Zaha', pos: 'PE' },
    { name: 'Simon Adingra', pos: 'PE' },
    { name: 'Franck Kessié', pos: 'VOL' },
  ],
  TUR: [
    { name: 'Hakan Çalhanoğlu', pos: 'MEI' },
    { name: 'Arda Güler', pos: 'MEI' },
  ],
  CZE: [{ name: 'Patrik Schick', pos: 'ATA' }],
  SCO: [{ name: 'Scott McTominay', pos: 'MEI' }],
  PAR: [{ name: 'Miguel Almirón', pos: 'MEI' }],
  PAN: [{ name: 'Adalberto Carrasquilla', pos: 'MEI' }],
  GHA: [
    { name: 'Mohammed Kudus', pos: 'MEI' },
    { name: 'Thomas Partey', pos: 'VOL' },
    { name: 'André Ayew', pos: 'ATA' },
  ],
  ALG: [
    { name: 'Riyad Mahrez', pos: 'PE' },
    { name: 'Ismaël Bennacer', pos: 'MEI' },
  ],
  KSA: [
    { name: 'Salem Al-Dawsari', pos: 'PE' },
    { name: 'Mohammed Al-Owais', pos: 'GOL' },
  ],
  RSA: [
    { name: 'Percy Tau', pos: 'PE' },
    { name: 'Ronwen Williams', pos: 'GOL' },
  ],
  IRN: [{ name: 'Mehdi Taremi', pos: 'ATA' }],
  BIH: [
    { name: 'Edin Džeko', pos: 'ATA' },
    { name: 'Miralem Pjanić', pos: 'MEI' },
  ],
  CPV: [
    { name: 'Ryan Mendes', pos: 'PE' },
    { name: 'Jovane Cabral', pos: 'PE' },
  ],
  QAT: [
    { name: 'Almoez Ali', pos: 'ATA' },
    { name: 'Akram Afif', pos: 'PE' },
  ],
  IRQ: [
    { name: 'Mohanad Ali', pos: 'ATA' },
    { name: 'Bashar Resan', pos: 'MEI' },
  ],
  JOR: [{ name: 'Musa Al-Taamari', pos: 'PE' }],
  NZL: [{ name: 'Chris Wood', pos: 'ATA' }],
  COD: [
    { name: 'Sébastien Haller', pos: 'ATA' },
    { name: 'Chancel Mbemba', pos: 'ZAG' },
  ],
  UZB: [
    { name: 'Eldor Shomurodov', pos: 'ATA' },
    { name: 'Jaloliddin Masharipov', pos: 'PE' },
  ],
  CUW: [
    { name: 'Leandro Bacuna', pos: 'MEI' },
    { name: 'Cuco Martina', pos: 'ZAG' },
  ],
  HAI: [
    { name: 'Duckens Nazon', pos: 'ATA' },
    { name: 'Zachary Herivaux', pos: 'VOL' },
  ],
};

const SQUAD_POSITIONS = [
  'GOL', 'GOL', 'GOL',
  'ZAG', 'ZAG', 'ZAG', 'ZAG',
  'LAT', 'LAT',
  'VOL',
  'MEI', 'MEI', 'MEI', 'MEI',
  'PE', 'PD',
  'ATA', 'ATA', 'ATA', 'ATA', 'ATA', 'ATA', 'ATA',
  'MEI', 'ZAG', 'LAT',
];

const mulberry32 = seed => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

function ovrForPlayer({ teamPower, pos, craque, destaque, rng }) {
  let base = teamPower;
  if (pos === 'GOL') base -= 1;
  if (pos === 'ZAG' || pos === 'LAT') base -= 2;
  if (pos === 'ATA' || pos === 'PE' || pos === 'PD') base += 1;
  if (craque) return clamp(base + 3 + rng() * 4, 88, 95);
  if (destaque) return clamp(base + 1 + rng() * 3, 82, 93);
  const spread = pos === 'GOL' ? 4 : 6;
  return clamp(base - 3 + rng() * spread, 78, 92);
}

function destaqueSlotCount(code) {
  const entry = DESTAQUE_NAMES[code];
  if (Array.isArray(entry)) return entry.length;
  if (typeof entry === 'number') return entry;
  return 0;
}

function normalizeDestaqueEntries(code) {
  const entry = DESTAQUE_NAMES[code];
  if (!Array.isArray(entry)) return [];
  return entry.map(item =>
    typeof item === 'string' ? { name: item, pos: null, used: false } : { ...item, used: false },
  );
}

function findNamedPlayerSlot(slots, used, preferredPos) {
  const alternates = {
    PE: ['PD', 'ATA', 'MEI'],
    PD: ['PE', 'ATA', 'MEI'],
    ATA: ['PE', 'PD', 'MEI'],
    MEI: ['MC', 'VOL', 'PE', 'PD'],
    MC: ['MEI', 'VOL'],
    VOL: ['MC', 'MEI'],
    LAT: ['ZAG'],
    ZAG: ['LAT', 'VOL'],
    GOL: [],
  };
  const candidates = [preferredPos, ...(alternates[preferredPos] || []), null];
  for (const pos of candidates) {
    const idx = slots.findIndex(
      (slot, index) => !used.has(index) && !slot.name && (pos == null || slot.pos === pos),
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function buildTeamSquad(code, meta) {
  const rng = mulberry32(meta.fifaRank * 997 + code.charCodeAt(0) * 13);
  const teamPower = nationalTeamPower(meta.block);
  const pool = meta.namePool || meta.name || 'Brasil';
  const craques = [...(CRAQUE_ROSTER[code] || [])];
  const destaqueFixed = normalizeDestaqueEntries(code);
  let destaqueSlots = destaqueSlotCount(code) - destaqueFixed.length;
  const slots = SQUAD_POSITIONS.map(pos => ({
    pos,
    name: null,
    craque: false,
    destaque: false,
  }));
  const used = new Set();

  const placeNamed = (entry, flags) => {
    const idx = findNamedPlayerSlot(slots, used, entry.pos || null);
    if (idx < 0) {
      console.warn(`[${code}] slot não encontrado: ${entry.name} (${entry.pos})`);
      return;
    }
    used.add(idx);
    slots[idx].name = entry.name;
    slots[idx].craque = !!flags.craque;
    slots[idx].destaque = !!flags.destaque;
  };

  craques.forEach(entry => placeNamed(entry, { craque: true }));
  destaqueFixed.forEach(entry => placeNamed(entry, { destaque: true }));

  const anonDestaqueIndices = new Set();
  const outfieldOrder = ['ATA', 'MEI', 'PE', 'PD', 'ZAG', 'LAT', 'VOL'];
  let anonDestaqueLeft = destaqueSlots;
  for (const pos of outfieldOrder) {
    if (anonDestaqueLeft <= 0) break;
    slots.forEach((slot, index) => {
      if (anonDestaqueLeft <= 0 || slot.name || anonDestaqueIndices.has(index)) return;
      if (slot.pos === pos) {
        anonDestaqueIndices.add(index);
        anonDestaqueLeft -= 1;
      }
    });
  }
  if (anonDestaqueLeft > 0) {
    slots.forEach((slot, index) => {
      if (anonDestaqueLeft <= 0 || slot.name || anonDestaqueIndices.has(index)) return;
      anonDestaqueIndices.add(index);
      anonDestaqueLeft -= 1;
    });
  }

  const players = slots.map((slot, index) => {
    let { name, craque, destaque, pos } = slot;
    if (!name) {
      if (anonDestaqueIndices.has(index)) {
        destaque = true;
        name = rollPlayerName({ nationality: pool, index: index + meta.fifaRank, random: rng });
      } else {
        name = rollPlayerName({ nationality: pool, index: index + meta.fifaRank * 3, random: rng });
      }
    }

    const player = {
      id: `wc26-${code.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
      name,
      pos,
      ovr: ovrForPlayer({ teamPower, pos, craque, destaque, rng }),
      nationality: meta.name,
      nationalityIso: meta.iso,
      age: rollNationalTeamPlayerAge({ pos, craque, destaque }, rng),
      nationalTeamOnly: true,
    };
    if (craque) player.craque = true;
    if (destaque) player.destaque = true;
    return player;
  });

  dedupeRosterNames(players);
  return players;
}

const teams = {};
for (const [code, meta] of Object.entries(NATIONAL_TEAMS)) {
  teams[code] = {
    code,
    name: meta.name,
    iso: meta.iso,
    fifaRank: meta.fifaRank,
    block: meta.block,
    teamPower: nationalTeamPower(meta.block),
    players: buildTeamSquad(code, meta),
  };
}

const payload = {
  version: '2026-1',
  tournament: 'Copa do Mundo 2026',
  squadSize: 26,
  squadsFrozen: true,
  squadsSourceEdition: 2026,
  squadsPolicy: 'Elenco fixo — força e sorteio vêm do ranking final da edição anterior.',
  teams,
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const playerCount = Object.values(teams).reduce((n, t) => n + t.players.length, 0);
const craqueCount = Object.values(teams).reduce(
  (n, t) => n + t.players.filter(p => p.craque).length,
  0,
);
const destaqueCountTotal = Object.values(teams).reduce(
  (n, t) => n + t.players.filter(p => p.destaque).length,
  0,
);

const ALT_POS = {
  PE: ['PD', 'ATA', 'MEI'],
  PD: ['PE', 'ATA', 'MEI'],
  ATA: ['PE', 'PD', 'MEI'],
  MEI: ['VOL', 'PE', 'PD'],
  LAT: ['ZAG'],
  ZAG: ['LAT', 'VOL'],
  VOL: ['MEI', 'ZAG'],
  GOL: [],
};
const okPos = (exp, act) => exp === act || (ALT_POS[exp] || []).includes(act);
const GK_DESTAQUE_OK = /^(Yann Sommer|Édouard Mendy|Mathew Ryan|Mohammed Al-Owais|Ronwen Williams)/;

let validationIssues = 0;
for (const [code, team] of Object.entries(teams)) {
  const byName = Object.fromEntries(team.players.map(p => [p.name, p]));
  for (const entry of [...(CRAQUE_ROSTER[code] || []), ...(Array.isArray(DESTAQUE_NAMES[code]) ? DESTAQUE_NAMES[code] : [])]) {
    const p = byName[entry.name];
    if (!p) {
      console.warn(`VALIDATE ${code}: ${entry.name} ausente após dedupe`);
      validationIssues += 1;
      continue;
    }
    if (!okPos(entry.pos, p.pos)) {
      console.warn(`VALIDATE ${code}: ${entry.name} esperado ${entry.pos}, obteve ${p.pos}`);
      validationIssues += 1;
    }
  }
  for (const p of team.players) {
    if (!(p.craque || p.destaque) || p.pos !== 'GOL') continue;
    if (p.craque || GK_DESTAQUE_OK.test(p.name)) continue;
    console.warn(`VALIDATE ${code}: ${p.name} destaque/craque em GOL`);
    validationIssues += 1;
  }
}

console.log(`Wrote ${outPath}`);
console.log(`Teams: ${Object.keys(teams).length}, Players: ${playerCount}`);
console.log(`Craques: ${craqueCount}, Destaques: ${destaqueCountTotal}`);
console.log(validationIssues ? `Validation: ${validationIssues} issue(s)` : 'Validation: OK');
