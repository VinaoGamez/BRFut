/**
 * Escudos de clubes — registry (Série A + aliases) + Lab de Times + fallback gerado por nome.
 * Arquivos estáticos: public/clubs/{slug}.svg (gerados por scripts/generate-club-crests.mjs).
 */

import { getCustomClubCrestArtwork } from './custom-clubs.js';
import { conmebolClubMeta } from './conmebol-clubs.js';

/** @type {Record<string, { slug: string, name: string, primary: string, secondary: string, pattern?: string, accent?: string }>} */
export const CLUB_CREST_ARTWORK = Object.freeze({
  palmeiras: {
    slug: 'palmeiras',
    name: 'Palmeiras',
    primary: '#006437',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  flamengo: {
    slug: 'flamengo',
    name: 'Flamengo',
    primary: '#C3281E',
    secondary: '#000000',
    pattern: 'horizontal',
  },
  gremio: {
    slug: 'gremio',
    name: 'Grêmio',
    primary: '#008BD1',
    secondary: '#000000',
    accent: '#ffffff',
    pattern: 'tricolor-v',
  },
  cruzeiro: {
    slug: 'cruzeiro',
    name: 'Cruzeiro',
    primary: '#1A3FA8',
    secondary: '#ffffff',
    pattern: 'solid',
    accent: '#ffffff',
  },
  bahia: {
    slug: 'bahia',
    name: 'Bahia',
    primary: '#004A99',
    secondary: '#E31E24',
    accent: '#ffffff',
    pattern: 'horizontal',
  },
  'sao-paulo': {
    slug: 'sao-paulo',
    name: 'São Paulo',
    primary: '#EC1C24',
    secondary: '#000000',
    accent: '#ffffff',
    pattern: 'horizontal',
  },
  internacional: {
    slug: 'internacional',
    name: 'Internacional',
    primary: '#C8102E',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  botafogo: {
    slug: 'botafogo',
    name: 'Botafogo',
    primary: '#000000',
    secondary: '#ffffff',
    pattern: 'stripes-h',
  },
  corinthians: {
    slug: 'corinthians',
    name: 'Corinthians',
    primary: '#000000',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  vasco: {
    slug: 'vasco',
    name: 'Vasco',
    primary: '#000000',
    secondary: '#ffffff',
    pattern: 'diagonal',
  },
  santos: {
    slug: 'santos',
    name: 'Santos',
    primary: '#ffffff',
    secondary: '#000000',
    pattern: 'vertical',
  },
  fluminense: {
    slug: 'fluminense',
    name: 'Fluminense',
    primary: '#7A263A',
    secondary: '#006B3F',
    accent: '#ffffff',
    pattern: 'horizontal',
  },
  'athletico-pr': {
    slug: 'athletico-pr',
    name: 'Athletico PR',
    primary: '#C8102E',
    secondary: '#000000',
    pattern: 'vertical',
  },
  bragantino: {
    slug: 'bragantino',
    name: 'Bragantino',
    primary: '#ffffff',
    secondary: '#CC0000',
    pattern: 'vertical',
  },
  fortaleza: {
    slug: 'fortaleza',
    name: 'Fortaleza',
    primary: '#003087',
    secondary: '#E31837',
    accent: '#ffffff',
    pattern: 'horizontal',
  },
  ceara: {
    slug: 'ceara',
    name: 'Ceará',
    primary: '#000000',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  goias: {
    slug: 'goias',
    name: 'Goiás',
    primary: '#006B3F',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  juventude: {
    slug: 'juventude',
    name: 'Juventude',
    primary: '#006B3F',
    secondary: '#ffffff',
    accent: '#006B3F',
    pattern: 'solid',
  },
  'estrela-do-cerrado': {
    slug: 'estrela-do-cerrado',
    name: 'Estrela do Cerrado',
    primary: '#245e42',
    secondary: '#d4af37',
    pattern: 'diagonal',
  },
});

const NAME_ALIASES = Object.freeze({
  gremio: 'gremio',
  'gremio fbpa': 'gremio',
  'sao paulo': 'sao-paulo',
  'são paulo': 'sao-paulo',
  spfc: 'sao-paulo',
  'athletico paranaense': 'athletico-pr',
  'athletico pr': 'athletico-pr',
  'athletico-paranaense': 'athletico-pr',
  'athletico-pr': 'athletico-pr',
  'cap': 'athletico-pr',
  'red bull bragantino': 'bragantino',
  'rb bragantino': 'bragantino',
  'vasco da gama': 'vasco',
  'cr vasco da gama': 'vasco',
  'cr flamengo': 'flamengo',
  'sc internacional': 'internacional',
  inter: 'internacional',
  'sc corinthians': 'corinthians',
  'se palmeiras': 'palmeiras',
  'santos fc': 'santos',
  'fluminense fc': 'fluminense',
  'ec bahia': 'bahia',
  'ec vitoria': 'vitoria',
  vitoria: 'vitoria',
  'ec vitoria ba': 'vitoria',
  'america-mg': 'america-mg',
  'america mg': 'america-mg',
  'atletico-mg': 'atletico-mg',
  'atletico mg': 'atletico-mg',
  'atletico mineiro': 'atletico-mg',
  'cuiaba': 'cuiaba',
  cuiaba: 'cuiaba',
  'cuiabá': 'cuiaba',
  sport: 'sport',
  'sport recife': 'sport',
});

/** Clubes extras comuns em estaduais / B/C — artwork dedicado. */
const EXTRA_CRESTS = Object.freeze({
  vitoria: {
    slug: 'vitoria',
    name: 'Vitória',
    primary: '#E31E24',
    secondary: '#000000',
    pattern: 'horizontal',
  },
  'america-mg': {
    slug: 'america-mg',
    name: 'América-MG',
    primary: '#006B3F',
    secondary: '#000000',
    pattern: 'vertical',
  },
  'atletico-mg': {
    slug: 'atletico-mg',
    name: 'Atlético-MG',
    primary: '#000000',
    secondary: '#ffffff',
    pattern: 'vertical',
  },
  cuiaba: {
    slug: 'cuiaba',
    name: 'Cuiabá',
    primary: '#006B3F',
    secondary: '#FFD100',
    pattern: 'vertical',
  },
  sport: {
    slug: 'sport',
    name: 'Sport',
    primary: '#E31E24',
    secondary: '#000000',
    pattern: 'vertical',
  },
});

const ALL_ARTWORK = Object.freeze({ ...CLUB_CREST_ARTWORK, ...EXTRA_CRESTS });

export function normClubKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function clubCrestSlug(clubName) {
  const raw = String(clubName || '').trim();
  if (!raw) return 'club';
  const alias = NAME_ALIASES[normClubKey(raw)];
  if (alias) return alias;
  const direct = normClubKey(raw).replace(/\s+/g, '-');
  if (ALL_ARTWORK[direct]) return direct;
  return direct || 'club';
}

export function resolveClubCrestArtwork(clubName) {
  const custom = getCustomClubCrestArtwork(clubName);
  if (custom) return custom;
  // Clubes sul-americanos fictícios: cores e formato do catálogo.
  const conmebol = conmebolClubMeta(clubName);
  if (conmebol) return { ...conmebol.crest, name: conmebol.name, custom: true };

  const key = normClubKey(clubName);
  const alias = NAME_ALIASES[key];
  if (alias && ALL_ARTWORK[alias]) return ALL_ARTWORK[alias];
  const slug = key.replace(/\s+/g, '-');
  if (ALL_ARTWORK[slug]) return ALL_ARTWORK[slug];
  for (const entry of Object.values(ALL_ARTWORK)) {
    if (normClubKey(entry.name) === key) return entry;
  }
  return null;
}

/** Cores e estilo estáveis derivados do nome (clubes gerados / Série D). */
export function deriveClubColors(clubName) {
  const label = String(clubName || 'Clube');
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const primary = `hsl(${hue} 58% 38%)`;
  const secondary = `hsl(${(hue + 168) % 360} 52% 92%)`;
  const shapes = ['classic', 'round', 'modern', 'banner', 'circle', 'hex'];
  const patterns = [
    'vertical',
    'horizontal',
    'diagonal',
    'stripes-h',
    'stripes-v',
    'tricolor-v',
    'chevron',
    'cross',
    'quarters',
    'ring',
    'half-arch',
    'solid',
  ];
  return {
    primary,
    secondary,
    accent: '#ffffff',
    shape: shapes[(hash >> 2) % shapes.length],
    pattern: patterns[hash % patterns.length],
  };
}

export function clubStyleInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

const SHIELD_SHAPES = Object.freeze({
  classic: 'M32 3 L57 13 L57 37 C57 53 32 69 32 69 C32 69 7 53 7 37 L7 13 Z',
  round: 'M32 5 C50 5 58 16 58 32 C58 50 32 67 32 67 C32 67 6 50 6 32 C6 16 14 5 32 5 Z',
  modern: 'M32 4 L55 15 L51 42 C51 55 32 70 32 70 C32 70 13 55 13 42 L9 15 Z',
  banner: 'M14 10 H50 V56 C50 56 32 66 14 56 Z',
  circle: 'M32 10 A22 22 0 1 1 31.99 10',
  hex: 'M32 6 L52 19 L52 45 L32 58 L12 45 L12 19 Z',
});

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function crestDisplayLabel(art, clubName) {
  const custom = String(art.label || '').trim();
  if (custom) return custom.slice(0, 16);
  return clubStyleInitials(art.name || clubName);
}

function splitLabelLines(text) {
  const clean = String(text || '').trim();
  if (!clean) return [''];
  if (clean.length <= 6 || !clean.includes(' ')) return [clean];
  const mid = Math.ceil(clean.split(' ').length / 2);
  const parts = clean.split(' ');
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
}

function resolveLabelFontSize(text, art) {
  const custom = Number(art?.labelSize);
  if (custom >= 8 && custom <= 28) return custom;

  const lines = splitLabelLines(text);
  const oneLine = lines.length === 1 ? lines[0] : null;
  const len = (oneLine || lines.join('')).length;
  if (len > 10) return 10;
  if (len > 7) return 12;
  if (len > 4) return 15;
  if (len > 3) return 17;
  return 20;
}

function resolveLabelColor(art) {
  if (art?.labelColor) return art.labelColor;
  if (art?.pattern === 'solid' || art?.pattern === 'ring') return art.accent || '#ffffff';
  return '#ffffff';
}

function labelMarkup(text, art, shape) {
  const lines = splitLabelLines(text);
  const oneLine = lines.length === 1 ? lines[0] : null;
  const fontSize = resolveLabelFontSize(text, art);
  const textFill = resolveLabelColor(art);
  const stroke = art?.labelStroke || 'rgba(0,0,0,.28)';

  const yBase = shape === 'banner' ? 42 : 44;
  if (oneLine) {
    return `<text x="32" y="${yBase}" text-anchor="middle" font-family="Barlow Condensed,Arial,sans-serif" font-weight="800" font-size="${fontSize}" fill="${textFill}" stroke="${stroke}" stroke-width=".5">${escapeSvgText(oneLine)}</text>`;
  }
  const lineHeight = fontSize + 2;
  return lines
    .map(
      (line, index) =>
        `<text x="32" y="${yBase - lineHeight / 2 + index * lineHeight}" text-anchor="middle" font-family="Barlow Condensed,Arial,sans-serif" font-weight="800" font-size="${fontSize}" fill="${textFill}" stroke="${stroke}" stroke-width=".5">${escapeSvgText(line)}</text>`,
    )
    .join('');
}

function patternMarkup(art) {
  const p = art.primary;
  const s = art.secondary;
  const a = art.accent || s;
  switch (art.pattern) {
    case 'vertical':
      return `<rect x="7" y="13" width="25" height="56" fill="${p}"/><rect x="32" y="13" width="25" height="56" fill="${s}"/>`;
    case 'horizontal':
      return `<rect x="7" y="13" width="50" height="28" fill="${p}"/><rect x="7" y="41" width="50" height="28" fill="${s}"/>`;
    case 'diagonal':
      return `<rect x="7" y="13" width="50" height="56" fill="${p}"/><path d="M7 13 L57 69 L57 13 Z" fill="${s}"/>`;
    case 'stripes-h':
      return [0, 1, 2, 3, 4]
        .map(
          i =>
            `<rect x="7" y="${13 + i * 11.2}" width="50" height="11.2" fill="${i % 2 ? s : p}"/>`,
        )
        .join('');
    case 'stripes-v':
      return [0, 1, 2, 3, 4]
        .map(
          i =>
            `<rect x="${7 + i * 10}" y="13" width="10" height="56" fill="${i % 2 ? s : p}"/>`,
        )
        .join('');
    case 'tricolor-v':
      return `<rect x="7" y="13" width="16.6" height="56" fill="${p}"/><rect x="23.6" y="13" width="16.6" height="56" fill="${a}"/><rect x="40.2" y="13" width="16.8" height="56" fill="${s}"/>`;
    case 'chevron':
      return `<rect x="7" y="13" width="50" height="56" fill="${p}"/><path d="M7 36 L32 60 L57 36 L57 13 L7 13 Z" fill="${s}"/>`;
    case 'cross':
      return `<rect x="7" y="13" width="50" height="56" fill="${p}"/><rect x="28" y="13" width="8" height="56" fill="${s}"/><rect x="7" y="38" width="50" height="8" fill="${s}"/>`;
    case 'quarters':
      return `<rect x="7" y="13" width="25" height="28" fill="${p}"/><rect x="32" y="13" width="25" height="28" fill="${s}"/><rect x="7" y="41" width="25" height="28" fill="${s}"/><rect x="32" y="41" width="25" height="28" fill="${p}"/>`;
    case 'ring':
      return `<path d="${art.shapePath}" fill="${p}"/><path d="${art.shapePath}" fill="none" stroke="${s}" stroke-width="5"/><circle cx="32" cy="38" r="11" fill="none" stroke="${a}" stroke-width="2.5"/>`;
    case 'half-arch':
      return `<rect x="7" y="13" width="50" height="28" fill="${p}"/><rect x="7" y="41" width="50" height="28" fill="${s}"/><path d="M7 41 Q32 58 57 41 Z" fill="${a}" opacity=".85"/>`;
    case 'solid':
    default:
      return `<path d="${art.shapePath}" fill="${p}"/>`;
  }
}

let crestSvgIdSeq = 0;

/* ---------------- Escudo v3 (Arcade Noturno) ----------------
 * Escudo único para todos os clubes: faixa escura no topo com a sigla de
 * 3 letras (sempre legível), padrão do clube abaixo, medalha branca com
 * emblema e contorno branco de "adesivo" para destacar no fundo escuro.
 */
const V3_SHIELD = 'M50 5 L91 16 V56 C91 84 71 101 50 110 C29 101 9 84 9 56 V16 Z';
const V3_BAND = '#0d1420';
const V3_EMBLEMS = ['star', 'ball', 'bolt', 'crown'];
const SIGLA_OVERRIDES = Object.freeze({ 'atletico-mg': 'CAM', 'america-mg': 'AME', 'athletico-pr': 'CAP' });
const SIGLA_STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'the', 'del', 'la', 'el', 'y']);

function crestHash(text) {
  let hash = 0;
  const label = String(text || 'Clube');
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return hash;
}

/** Sigla de até 3 letras: "Corinthians" → COR, "Estrela do Cerrado" → ECE, "Red Bull Bragantino" → RBB. */
export function clubCrestSigla(name) {
  const words = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const main = words.filter(word => !SIGLA_STOPWORDS.has(word.toLowerCase()));
  const pool = main.length ? main : words;
  if (!pool.length) return 'FC';
  if (pool.length === 1) return pool[0].slice(0, 3).toUpperCase();
  if (pool.length === 2) return (pool[0][0] + pool[1].slice(0, 2)).toUpperCase();
  return pool.map(word => word[0]).join('').slice(0, 3).toUpperCase();
}

function hexToRgb(color) {
  const value = String(color || '').trim();
  const hsl = value.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (hsl) {
    const h = Number(hsl[1]) / 360;
    const sat = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const conv = t => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return [conv(h + 1 / 3), conv(h), conv(h - 1 / 3)].map(v => Math.round(v * 255));
  }
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(color) {
  const [r, g, b] = hexToRgb(color).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function v3PatternMarkup(pattern, p, s, a) {
  switch (pattern) {
    case 'vertical':
      return `<rect x="50" y="0" width="50" height="116" fill="${s}"/>`;
    case 'horizontal':
    case 'half-arch':
      return `<rect x="0" y="62" width="100" height="54" fill="${s}"/>`;
    case 'diagonal':
      return `<polygon points="-10,34 8,18 112,104 94,120" fill="${s}"/>`;
    case 'stripes-h':
      return `<rect x="0" y="44" width="100" height="11" fill="${s}"/><rect x="0" y="70" width="100" height="11" fill="${s}"/><rect x="0" y="96" width="100" height="11" fill="${s}"/>`;
    case 'stripes-v':
      return `<rect x="22" y="0" width="13" height="116" fill="${s}"/><rect x="65" y="0" width="13" height="116" fill="${s}"/>`;
    case 'tricolor-v':
      return `<rect x="36" y="0" width="28" height="116" fill="${a}"/><rect x="64" y="0" width="36" height="116" fill="${s}"/>`;
    case 'chevron':
      return `<polygon points="0,50 50,80 100,50 100,66 50,96 0,66" fill="${s}"/>`;
    case 'cross':
      return `<rect x="44" y="0" width="12" height="116" fill="${s}"/><rect x="0" y="80" width="100" height="12" fill="${s}"/>`;
    case 'quarters':
      return `<rect x="50" y="0" width="50" height="62" fill="${s}"/><rect x="0" y="62" width="50" height="54" fill="${s}"/>`;
    case 'ring':
      return `<path d="${V3_SHIELD}" fill="none" stroke="${s}" stroke-width="9" transform="translate(50 58) scale(.86) translate(-50 -58)"/>`;
    case 'solid':
    default:
      return '';
  }
}

function v3EmblemMarkup(emblem, color) {
  switch (emblem) {
    case 'ball':
      return `<circle cx="50" cy="66" r="10" fill="none" stroke="${color}" stroke-width="2.4"/><polygon fill="${color}" points="50,61.5 54.3,64.6 52.6,69.6 47.4,69.6 45.7,64.6"/>`;
    case 'bolt':
      return `<polygon fill="${color}" points="53.5,53.5 42.5,68 49.5,68 46.5,78.5 57.5,63.5 50.5,63.5"/>`;
    case 'crown':
      return `<polygon fill="${color}" points="39.5,72 39.5,59 45,64.5 50,57 55,64.5 60.5,59 60.5,72"/><rect x="39.5" y="73.5" width="21" height="3" fill="${color}"/>`;
    case 'star':
    default:
      return `<polygon fill="${color}" points="50,55 52.7,62.28 60.46,62.6 54.37,67.42 56.47,74.9 50,70.6 43.53,74.9 45.63,67.42 39.54,62.6 47.3,62.28"/>`;
  }
}

/** SVG do escudo v3 (usado no runtime, no Lab e no gerador estático). */
export function buildClubCrestSvg(clubName, artwork = null, idSuffix = '') {
  const art = artwork || resolveClubCrestArtwork(clubName) || {
    ...deriveClubColors(clubName),
    name: clubName,
  };
  const name = art.name || clubName;
  const hash = crestHash(name);
  const primary = art.primary || '#1f6b3a';
  const secondary = art.secondary || '#ffffff';
  const accent = art.accent || secondary;
  const custom = String(art.label || '').trim();
  const sigla = (custom && custom.length <= 4 ? custom : (SIGLA_OVERRIDES[art.slug] || SIGLA_OVERRIDES[clubCrestSlug(name)] || clubCrestSigla(name))).toUpperCase();
  const siglaSize = sigla.length >= 4 ? 14 : 17;
  const emblem = V3_EMBLEMS.includes(art.emblem) ? art.emblem : V3_EMBLEMS[(hash >> 3) % V3_EMBLEMS.length];
  const emblemColor = luminance(primary) > 0.6
    ? (luminance(secondary) > 0.6 ? V3_BAND : secondary)
    : primary;
  const trim = luminance(secondary) > 0.15 ? secondary : '#e8edf2';
  const slug = clubCrestSlug(clubName).replace(/[^a-z0-9-]/gi, '') || 'x';
  const clipId = `crest-${slug}${idSuffix || ''}-${++crestSvgIdSeq}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 112 128" role="img" aria-label="${escapeSvgText(name)}" style="background:transparent">
  <defs><clipPath id="${clipId}"><path d="${V3_SHIELD}"/></clipPath></defs>
  <path d="${V3_SHIELD}" fill="#ffffff" stroke="#ffffff" stroke-width="9" stroke-linejoin="round"/>
  <path d="${V3_SHIELD}" fill="${primary}" stroke="${V3_BAND}" stroke-width="3.2" stroke-linejoin="round"/>
  <g clip-path="url(#${clipId})">
    ${v3PatternMarkup(art.pattern, primary, secondary, accent)}
    <rect x="0" y="0" width="100" height="32" fill="${V3_BAND}"/>
    <rect x="0" y="32" width="100" height="2.5" fill="${trim}"/>
  </g>
  <text x="50" y="26" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-weight="800" font-size="${siglaSize}" letter-spacing="1.4" fill="#ffffff">${escapeSvgText(sigla)}</text>
  <circle cx="50" cy="66" r="16" fill="#ffffff" stroke="${V3_BAND}" stroke-width="2.2"/>
  ${v3EmblemMarkup(emblem, emblemColor)}
</svg>`;
}

export function buildClubCrestDataUrl(clubName) {
  const svg = buildClubCrestSvg(clubName);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Só escudos gerados em public/clubs/ — não slugs Brasfoot de clubes custom. */
function bundledCrestStaticUrl(art) {
  if (!art?.slug || art.custom) return null;
  if (!ALL_ARTWORK[art.slug]) return null;
  return `./clubs/${art.slug}.svg`;
}

/** PNG/SVG estático ou upload data URL do Lab. */
export function clubCrestAssetUrl(clubName) {
  const art = resolveClubCrestArtwork(clubName);
  if (!art?.slug) return null;
  if (art.image) {
    if (typeof art.image === 'string' && art.image.startsWith('data:')) return art.image;
    return `./clubs/${art.image}`;
  }
  return bundledCrestStaticUrl(art);
}

export function resolveClubCrest(clubName) {
  const label = String(clubName || '').trim();
  if (!label) return null;
  const art = resolveClubCrestArtwork(label);
  let assetUrl = null;
  if (art?.slug) {
    if (typeof art.image === 'string' && art.image.startsWith('data:')) assetUrl = art.image;
    else if (art.image) assetUrl = `./clubs/${art.image}`;
    else assetUrl = bundledCrestStaticUrl(art);
  }
  return {
    name: art?.name || label,
    slug: art?.slug || clubCrestSlug(label),
    url: assetUrl || buildClubCrestDataUrl(label),
    static: !!assetUrl,
  };
}

export function clubCrestUrl(clubName) {
  return resolveClubCrest(clubName)?.url || null;
}
