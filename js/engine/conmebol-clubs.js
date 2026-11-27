/**
 * Clubes sul-americanos fora do Brasil — universo fictício da CONMEBOL.
 *
 * Os nomes são inspirados em apelidos e bairros (o "Millonarios de Núñez", o
 * "Carboneros de Montevideo"), nunca a marca registrada do clube real. Mesma
 * regra que vale para os clubes brasileiros do jogo.
 *
 * Esses clubes NÃO entram no registro `clubs` da carreira: ficam num registro
 * próprio, consultado só por quem joga partida (simulador, ao vivo, escudo).
 * Assim mercado, ranking nacional, base e aposentadorias não enxergam
 * estrangeiros, e o elenco pode ser regenerado de forma determinística a cada
 * boot sem pesar no save.
 *
 * Força (power) segue a escala do jogo: Série A vai de 52 a 62.
 */

import { createSeededRandom } from './brazil-official-pyramid.js';
import { hashSeedString } from './club-roster-seed.js';
import {
  buildSquadRoles,
  generatePlayer,
  pickStarterFlags,
  rollProfessionalSquadSize,
} from './player-generation.js';
import { dedupeRosterNames } from './player-names.js';

/** Países CONMEBOL além do Brasil, com a nacionalidade usada nos nomes. */
export const CONMEBOL_FOREIGN_COUNTRIES = Object.freeze({
  ARG: Object.freeze({ code: 'ARG', name: 'Argentina', nationality: 'Argentina', flag: 'AR' }),
  URU: Object.freeze({ code: 'URU', name: 'Uruguai', nationality: 'Uruguai', flag: 'UY' }),
  PAR: Object.freeze({ code: 'PAR', name: 'Paraguai', nationality: 'Paraguai', flag: 'PY' }),
  COL: Object.freeze({ code: 'COL', name: 'Colômbia', nationality: 'Colombia', flag: 'CO' }),
  CHI: Object.freeze({ code: 'CHI', name: 'Chile', nationality: 'Chile', flag: 'CL' }),
  ECU: Object.freeze({ code: 'ECU', name: 'Equador', nationality: 'Equador', flag: 'EC' }),
  PER: Object.freeze({ code: 'PER', name: 'Peru', nationality: 'Peru', flag: 'PE' }),
  BOL: Object.freeze({ code: 'BOL', name: 'Bolívia', nationality: 'Bolívia', flag: 'BO' }),
  VEN: Object.freeze({ code: 'VEN', name: 'Venezuela', nationality: 'Venezuela', flag: 'VE' }),
});

/** Faixa de força por país e nível (1 = elite do país). */
const POWER_BY_COUNTRY_TIER = Object.freeze({
  ARG: [[59, 62], [56, 59], [53, 56], [50, 53]],
  URU: [[55, 58], [52, 55], [49, 52], [46, 49]],
  PAR: [[55, 58], [52, 55], [49, 52], [46, 49]],
  COL: [[55, 58], [52, 55], [49, 52], [46, 49]],
  ECU: [[55, 58], [52, 55], [49, 52], [46, 49]],
  CHI: [[53, 56], [50, 53], [47, 50], [44, 47]],
  PER: [[53, 56], [50, 53], [47, 50], [44, 47]],
  BOL: [[50, 53], [47, 50], [44, 47], [41, 44]],
  VEN: [[50, 53], [47, 50], [44, 47], [41, 44]],
});

/**
 * [nome, cidade, estádio, cor primária, cor secundária, nível, altitude em metros]
 * Altitude fica guardada para uso futuro (desgaste de visitante).
 */
const CATALOG = Object.freeze({
  ARG: [
    ['Millonarios de Núñez', 'Buenos Aires', 'Estadio del Bajo Belgrano', '#ffffff', '#d7262e', 1, 25],
    ['Xeneizes de La Ribera', 'Buenos Aires', 'La Caldera de La Ribera', '#0b3a8c', '#f5c400', 1, 10],
    ['Academia de Avellaneda', 'Avellaneda', 'Coliseo de Avellaneda', '#7cc0ea', '#ffffff', 1, 15],
    ['Diablos Rojos de Avellaneda', 'Avellaneda', 'Fortaleza Roja', '#c8102e', '#ffffff', 2, 15],
    ['Ciclón de Boedo', 'Buenos Aires', 'Estadio del Bajo Flores', '#0b2a6b', '#c8102e', 2, 20],
    ['Pinchas de La Plata', 'La Plata', 'Coliseo Platense', '#d7262e', '#ffffff', 1, 20],
    ['Fortín de Liniers', 'Buenos Aires', 'Estadio de Liniers', '#ffffff', '#1d4fd8', 2, 30],
    ['Granates del Sur', 'Lanús', 'La Fortaleza Granate', '#7a1f2b', '#ffffff', 2, 15],
    ['Matadores de Victoria', 'Victoria', 'Estadio del Delta', '#1d3f8f', '#d7262e', 3, 5],
    ['Albiazules de Córdoba', 'Córdoba', 'Estadio Mediterráneo', '#0b2a6b', '#ffffff', 3, 390],
    ['Canallas de Rosario', 'Rosario', 'Estadio del Arroyo', '#13399c', '#f7c600', 3, 25],
    ['Leprosos de Rosario', 'Rosario', 'Estadio del Parque', '#c8102e', '#111111', 3, 25],
    ['Bichos de La Paternal', 'Buenos Aires', 'Semillero de La Paternal', '#d7262e', '#ffffff', 4, 25],
    ['Calamares de Saavedra', 'Buenos Aires', 'Estadio de Saavedra', '#5a3a22', '#ffffff', 4, 20],
    ['Tatengues de Santa Fe', 'Santa Fe', 'Estadio del Litoral', '#d7262e', '#ffffff', 4, 25],
    ['Taladros del Sur', 'Banfield', 'Estadio del Sur', '#1f8a4c', '#ffffff', 4, 15],
  ],
  URU: [
    ['Carboneros de Montevideo', 'Montevidéu', 'Estadio de Las Acacias', '#f5c400', '#111111', 1, 40],
    ['Tricolores del Parque', 'Montevidéu', 'Estadio del Parque Central', '#ffffff', '#1d3f8f', 1, 40],
    ['Violetas del Prado', 'Montevidéu', 'Estadio del Prado', '#5b2a86', '#ffffff', 2, 40],
    ['Franjeados de Maroñas', 'Montevidéu', 'Estadio de Maroñas', '#ffffff', '#111111', 2, 40],
    ['Bohemios del Prado', 'Montevidéu', 'Parque de los Bohemios', '#111111', '#ffffff', 2, 40],
    ['Negriazules de Belvedere', 'Montevidéu', 'Estadio de Belvedere', '#111111', '#1d4fd8', 3, 40],
    ['Villeros del Cerro', 'Montevidéu', 'Estadio del Cerro', '#7cc0ea', '#ffffff', 3, 40],
    ['Sastres de Montevideo', 'Montevidéu', 'Estadio del Buceo', '#1f8a4c', '#ffffff', 3, 40],
    ['Fernandinos de Maldonado', 'Maldonado', 'Estadio de la Costa', '#c8102e', '#1f8a4c', 4, 30],
    ['Gauchos del Pantanoso', 'Montevidéu', 'Estadio del Pantanoso', '#f5c400', '#c8102e', 4, 40],
  ],
  PAR: [
    ['Decanos de Asunción', 'Assunção', 'Estadio del Bosque', '#ffffff', '#111111', 1, 50],
    ['Azulgranas de Barrio Obrero', 'Assunção', 'La Olla Azulgrana', '#1d3f8f', '#c8102e', 1, 50],
    ['Gumarelos de Tuyucuá', 'Assunção', 'Estadio de Tuyucuá', '#111111', '#ffffff', 2, 60],
    ['Aborígenes de Asunción', 'Assunção', 'Estadio de Dos Bocas', '#f5c400', '#111111', 2, 50],
    ['Kelitos de Luque', 'Luque', 'Estadio de Luque', '#1d4fd8', '#f5c400', 2, 80],
    ['Tricolores de Sajonia', 'Assunção', 'Estadio de Sajonia', '#ffffff', '#c8102e', 3, 50],
    ['Gallos del Norte', 'Pedro Juan Caballero', 'Estadio de la Frontera', '#c8102e', '#ffffff', 3, 660],
    ['Trinitarios de Asunción', 'Assunção', 'Estadio de Trinidad', '#f28c28', '#ffffff', 3, 50],
    ['Laureles de Lambaré', 'Lambaré', 'Estadio de Lambaré', '#1f8a4c', '#ffffff', 4, 80],
    ['Rayados de San Lorenzo', 'San Lorenzo', 'Estadio de San Lorenzo', '#c8102e', '#ffffff', 4, 120],
  ],
  COL: [
    ['Verdolagas de Medellín', 'Medellín', 'Estadio del Valle de Aburrá', '#1f8a4c', '#ffffff', 1, 1495],
    ['Embajadores de Bogotá', 'Bogotá', 'Estadio de la Sabana', '#1d4fd8', '#ffffff', 1, 2640],
    ['Diablos Rojos de Cali', 'Cali', 'Estadio del Pascual', '#c8102e', '#ffffff', 2, 1000],
    ['Tiburones de Barranquilla', 'Barranquilla', 'Estadio del Caribe', '#c8102e', '#ffffff', 2, 20],
    ['Poderosos de la Montaña', 'Medellín', 'Estadio de la Montaña', '#c8102e', '#1d3f8f', 2, 1495],
    ['Azucareros del Valle', 'Cali', 'Estadio del Cañaveral', '#1f8a4c', '#ffffff', 3, 1000],
    ['Cardenales de Bogotá', 'Bogotá', 'Estadio de Chapinero', '#c8102e', '#ffffff', 3, 2640],
    ['Pijaos de Ibagué', 'Ibagué', 'Estadio del Tolima', '#f5c400', '#7a1f2b', 3, 1285],
    ['Leopardos de Bucaramanga', 'Bucaramanga', 'Estadio de la Ciudad Bonita', '#f5c400', '#1f8a4c', 4, 960],
    ['Blancos de Manizales', 'Manizales', 'Estadio del Nevado', '#ffffff', '#1d3f8f', 4, 2150],
  ],
  CHI: [
    ['Caciques de Macul', 'Santiago', 'Estadio de Macul', '#ffffff', '#111111', 1, 570],
    ['Chunchos de Santiago', 'Santiago', 'Estadio del Chuncho', '#1d3f8f', '#c8102e', 1, 570],
    ['Cruzados de San Carlos', 'Santiago', 'Estadio de San Carlos', '#ffffff', '#1d4fd8', 2, 700],
    ['Celestes de Rancagua', 'Rancagua', 'Estadio de El Teniente', '#7cc0ea', '#ffffff', 2, 500],
    ['Tino-Tinos de La Cisterna', 'Santiago', 'Estadio de La Cisterna', '#1f8a4c', '#c8102e', 2, 570],
    ['Acereros de Talcahuano', 'Talcahuano', 'Estadio del Acero', '#1d3f8f', '#111111', 3, 10],
    ['Piratas de Coquimbo', 'Coquimbo', 'Estadio del Puerto', '#f5c400', '#111111', 3, 20],
    ['Audaces de La Florida', 'Santiago', 'Estadio de La Florida', '#1f8a4c', '#ffffff', 3, 620],
    ['Ruleteros de Viña', 'Viña del Mar', 'Estadio de Sausalito', '#1d4fd8', '#f5c400', 4, 10],
    ['Albirrojos de Ñuble', 'Chillán', 'Estadio de Ñuble', '#c8102e', '#ffffff', 4, 120],
  ],
  ECU: [
    ['Albos de Quito', 'Quito', 'La Casa Blanca de Quito', '#ffffff', '#c8102e', 1, 2850],
    ['Ídolos del Astillero', 'Guayaquil', 'Estadio del Astillero', '#f5c400', '#111111', 1, 5],
    ['Bombilleros de Guayaquil', 'Guayaquil', 'Estadio del Bombillo', '#1d3f8f', '#ffffff', 2, 5],
    ['Matagigantes del Valle', 'Sangolquí', 'Estadio del Valle', '#111111', '#1d4fd8', 1, 2500],
    ['Orientales de Quito', 'Quito', 'Estadio del Oriente', '#f5c400', '#c8102e', 2, 2850],
    ['Chullas de Quito', 'Quito', 'Estadio del Batán', '#1d3f8f', '#c8102e', 3, 2850],
    ['Morlacos de Cuenca', 'Cuenca', 'Estadio de los Andes', '#c8102e', '#111111', 3, 2560],
    ['Ponchos de Ambato', 'Ambato', 'Estadio de Bellavista', '#7cc0ea', '#ffffff', 3, 2580],
    ['Orenses de Machala', 'Machala', 'Estadio del Banano', '#1f8a4c', '#ffffff', 4, 10],
    ['Delfines de Manta', 'Manta', 'Estadio del Pacífico', '#1d4fd8', '#f5c400', 4, 10],
  ],
  PER: [
    ['Cremas de Ate', 'Lima', 'Monumental de Ate', '#f3ead3', '#b71c1c', 1, 300],
    ['Íntimos de La Victoria', 'Lima', 'Estadio de La Victoria', '#1d3f8f', '#ffffff', 1, 150],
    ['Celestes del Rímac', 'Lima', 'Estadio del Rímac', '#7cc0ea', '#ffffff', 2, 160],
    ['Rojos del Cusco', 'Cusco', 'Estadio del Inca', '#c8102e', '#ffffff', 2, 3400],
    ['Dominós de Arequipa', 'Arequipa', 'Estadio del Misti', '#c8102e', '#111111', 2, 2330],
    ['Carlistas de Trujillo', 'Trujillo', 'Estadio del Chimú', '#1d4fd8', '#ffffff', 3, 30],
    ['Poderosos del Altiplano', 'Juliaca', 'Estadio del Titicaca', '#1d3f8f', '#ffffff', 3, 3825],
    ['Chalacos del Callao', 'Callao', 'Estadio del Callao', '#e94f8b', '#111111', 3, 10],
    ['Ciclón del Norte', 'Chiclayo', 'Estadio del Norte', '#c8102e', '#f5c400', 4, 30],
    ['Rojos de Huancayo', 'Huancayo', 'Estadio del Mantaro', '#c8102e', '#ffffff', 4, 3250],
  ],
  BOL: [
    ['Académicos de La Paz', 'La Paz', 'Estadio del Illimani', '#7cc0ea', '#ffffff', 1, 3640],
    ['Atigrados de Achumani', 'La Paz', 'Estadio de Achumani', '#f5c400', '#111111', 1, 3640],
    ['Millonarios de La Paz', 'El Alto', 'Estadio de El Alto', '#c8102e', '#ffffff', 2, 4090],
    ['Refineros de Santa Cruz', 'Santa Cruz', 'Estadio del Oriente', '#1f8a4c', '#ffffff', 2, 415],
    ['Celestes de Santa Cruz', 'Santa Cruz', 'Estadio del Piraí', '#7cc0ea', '#ffffff', 2, 415],
    ['Aviadores de Cochabamba', 'Cochabamba', 'Estadio del Valle Alto', '#c8102e', '#ffffff', 3, 2560],
    ['Petroleros del Chaco', 'Sucre', 'Estadio de la Capital', '#c8102e', '#1d3f8f', 3, 2810],
    ['Mineros de Potosí', 'Potosí', 'Estadio del Cerro Rico', '#7a1f2b', '#ffffff', 3, 3900],
    ['Bulos de Shinahota', 'Shinahota', 'Estadio del Trópico', '#1f8a4c', '#f5c400', 4, 230],
    ['Guabireños de Montero', 'Montero', 'Estadio de Montero', '#c8102e', '#ffffff', 4, 300],
  ],
  VEN: [
    ['Rojos del Ávila', 'Caracas', 'Estadio del Ávila', '#c8102e', '#ffffff', 1, 900],
    ['Aurinegros de San Cristóbal', 'San Cristóbal', 'Estadio de Pueblo Nuevo', '#f5c400', '#111111', 1, 825],
    ['Guaireños del Litoral', 'La Guaira', 'Estadio del Litoral', '#f28c28', '#1d3f8f', 2, 10],
    ['Granates de Valencia', 'Valencia', 'Estadio del Carabobo', '#7a1f2b', '#ffffff', 2, 480],
    ['Académicos de Caracas', 'Caracas', 'Estadio Universitario de Caracas', '#1d3f8f', '#ffffff', 2, 900],
    ['Azulgranas de Maturín', 'Maturín', 'Estadio de Maturín', '#1d3f8f', '#c8102e', 3, 70],
    ['Portuarios de Puerto Cabello', 'Puerto Cabello', 'Estadio del Puerto', '#1d4fd8', '#ffffff', 3, 10],
    ['Metropolitanos de Valencia', 'Valencia', 'Estadio Metropolitano', '#5b2a86', '#ffffff', 3, 480],
    ['Rojiblancos de los Andes', 'Mérida', 'Estadio de los Andes', '#c8102e', '#ffffff', 4, 1600],
    ['Zamoranos de Barinas', 'Barinas', 'Estadio de los Llanos', '#ffffff', '#111111', 4, 185],
  ],
});

const CREST_PATTERNS = ['vertical', 'horizontal', 'diagonal', 'stripes-v', 'chevron', 'half-arch', 'quarters', 'ring'];
const CREST_SHAPES = ['classic', 'round', 'modern', 'banner', 'circle', 'hex'];
const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-1-4-1', '5-3-2', '4-3-1-2'];
const STYLES = ['Posse de bola', 'Contra-ataque', 'Pressão alta'];
const MENTALITIES = ['Defensiva', 'Equilibrada', 'Ofensiva'];

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function initialsOf(name) {
  const skip = new Set(['de', 'del', 'la', 'las', 'los', 'el']);
  const words = String(name).split(/\s+/).filter(word => !skip.has(word.toLowerCase()));
  // Duas letras cabem em qualquer formato de escudo: apelido + cidade.
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map(word => word[0]).join('').toUpperCase();
}

/** Ficha imutável de cada clube estrangeiro. */
export const CONMEBOL_CLUBS = Object.freeze(
  Object.entries(CATALOG).flatMap(([country, rows]) =>
    rows.map(([name, city, stadium, primary, secondary, tier, altitude], index) => {
      const slug = slugify(name);
      const rng = createSeededRandom(hashSeedString(`crest:${slug}`));
      return Object.freeze({
        name,
        slug,
        country,
        countryName: CONMEBOL_FOREIGN_COUNTRIES[country].name,
        nationality: CONMEBOL_FOREIGN_COUNTRIES[country].nationality,
        city,
        stadium,
        tier,
        altitude,
        catalogIndex: index,
        initials: initialsOf(name),
        crest: Object.freeze({
          slug,
          primary,
          secondary,
          pattern: CREST_PATTERNS[Math.floor(rng() * CREST_PATTERNS.length)],
          shape: CREST_SHAPES[Math.floor(rng() * CREST_SHAPES.length)],
          label: initialsOf(name),
        }),
      });
    }),
  ),
);

const BY_NAME = new Map(CONMEBOL_CLUBS.map(club => [club.name, club]));

/** Ficha do clube estrangeiro, ou null se o nome não é CONMEBOL de fora. */
export function conmebolClubMeta(name) {
  return BY_NAME.get(name) || null;
}

export function isConmebolForeignClub(name) {
  return BY_NAME.has(name);
}

/** Clubes de um país, na ordem do catálogo. */
export function conmebolClubsOf(country) {
  return CONMEBOL_CLUBS.filter(club => club.country === country);
}

/**
 * Força base do clube numa temporada: faixa do nível + pequena oscilação anual
 * determinística, para os ciclos de cada país não ficarem congelados.
 */
export function conmebolClubBasePower(meta, { careerSeed = 0, seasonYear = 2026 } = {}) {
  if (!meta) return 50;
  const ranges = POWER_BY_COUNTRY_TIER[meta.country] || POWER_BY_COUNTRY_TIER.BOL;
  const [lo, hi] = ranges[Math.min(ranges.length, Math.max(1, meta.tier)) - 1];
  const rng = createSeededRandom(hashSeedString(`power:${careerSeed}:${meta.slug}:${seasonYear}`));
  return Math.round(lo + rng() * (hi - lo));
}

/**
 * Classificação da liga nacional de um país numa temporada: força + sorte.
 * Usada para distribuir as vagas continentais do país no ano seguinte.
 *
 * @returns {string[]} nomes do 1º ao último
 */
export function simulateForeignLeagueTable(country, { careerSeed = 0, seasonYear = 2026, boost = {} } = {}) {
  const rng = createSeededRandom(hashSeedString(`league:${careerSeed}:${country}:${seasonYear}`));
  return conmebolClubsOf(country)
    .map(meta => ({
      name: meta.name,
      score: conmebolClubBasePower(meta, { careerSeed, seasonYear }) + (rng() * 8 - 4) + (Number(boost[meta.name]) || 0),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
    .map(row => row.name);
}

/** Nacionalidade de cada jogador: maioria local, alguns vizinhos e brasileiros. */
function rollForeignNationality(meta, rng) {
  const roll = rng();
  if (roll < 0.82) return meta.nationality;
  if (roll < 0.9) return 'Brasil';
  const neighbours = Object.values(CONMEBOL_FOREIGN_COUNTRIES).filter(c => c.code !== meta.country);
  return neighbours[Math.floor(rng() * neighbours.length)].nationality;
}

/**
 * Monta o clube jogável (elenco, tática, indicadores) de forma determinística:
 * mesma carreira + clube + temporada = mesmo elenco.
 */
export function buildConmebolClub(meta, { careerSeed = 0, seasonYear = 2026, firstNames = [], lastNames = [] } = {}) {
  if (!meta) return null;
  const rng = createSeededRandom(hashSeedString(`roster:${careerSeed}:${meta.slug}:${seasonYear}`));
  const basePower = conmebolClubBasePower(meta, { careerSeed, seasonYear });
  const roles = buildSquadRoles(rollProfessionalSquadSize(rng));
  const starterFlags = pickStarterFlags(roles.length, rng);
  // Elite continental gera na faixa da Série A; o resto, na da Série B.
  const genDivision = basePower >= 50 ? 'A' : 'B';
  const roster = roles.map((role, playerIndex) => {
    const player = generatePlayer({
      role,
      index: playerIndex + meta.catalogIndex * 31,
      clubPower: basePower,
      division: genDivision,
      random: rng,
      firstNames,
      lastNames,
      nationality: rollForeignNationality(meta, rng),
      starterBoost: starterFlags[playerIndex],
    });
    player.playerId = `cmb-${meta.slug}-${seasonYear}-${playerIndex + 1}`;
    return player;
  });
  dedupeRosterNames(roster, { random: rng });
  roster.forEach((player, index) => { player.number = index + 1; });
  const top11 = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const power = Math.round(top11.reduce((sum, player) => sum + player.overall, 0) / 11);
  const pick = list => list[Math.floor(rng() * list.length)];
  return {
    name: meta.name,
    division: 'INT',
    country: meta.country,
    conmebolForeign: true,
    countryName: meta.countryName,
    uf: null,
    city: meta.city,
    stadiumName: meta.stadium,
    altitude: meta.altitude,
    tier: meta.tier,
    power,
    basePower,
    roster,
    formation: pick(FORMATIONS),
    style: pick(STYLES),
    mentality: pick(MENTALITIES),
    position: meta.tier * 3,
    environment: 55 + Math.round(rng() * 20),
    support: 60 + Math.round(rng() * 25),
    board: 50 + Math.round(rng() * 25),
    finances: 45 + Math.round(rng() * 30),
    crest: meta.crest,
  };
}

/**
 * Registro preguiçoso dos clubes estrangeiros de uma carreira. Só monta o
 * elenco quando alguém pede o clube (sorteio, simulação, jogo ao vivo).
 */
export function createConmebolClubRegistry({ careerSeed = 0, firstNames = [], lastNames = [] } = {}) {
  const cache = new Map();
  let seasonYear = 2026;
  const key = name => `${seasonYear}:${name}`;
  return {
    setSeason(year) {
      const next = Number(year) || seasonYear;
      if (next !== seasonYear) cache.clear();
      seasonYear = next;
    },
    get season() {
      return seasonYear;
    },
    get(name) {
      const meta = conmebolClubMeta(name);
      if (!meta) return null;
      const k = key(name);
      if (!cache.has(k)) cache.set(k, buildConmebolClub(meta, { careerSeed, seasonYear, firstNames, lastNames }));
      return cache.get(k);
    },
    has: isConmebolForeignClub,
    loaded() {
      return [...cache.values()];
    },
    power(name) {
      const loaded = cache.get(key(name));
      if (loaded) return loaded.power;
      return conmebolClubBasePower(conmebolClubMeta(name), { careerSeed, seasonYear });
    },
  };
}
