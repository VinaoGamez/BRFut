/**
 * Elencos das seleções sul-americanas que não estão no JSON da Copa de 2026
 * (Chile, Peru, Venezuela, Bolívia). Gerados de forma determinística, na faixa
 * do bloco 4 (OVR ~79–89, como Haiti e Curaçao no JSON), para jogarem as
 * Eliminatórias ao vivo e a Copa quando se classificam.
 */
import { EXTRA_NATIONAL_TEAMS, nationalTeamPower } from './national-teams.js';

const NAMES = Object.freeze({
  CHI: {
    first: ['Alexis', 'Arturo', 'Charles', 'Claudio', 'Marcelo', 'Gary', 'Eduardo', 'Felipe', 'Ben', 'Darío', 'Víctor', 'Guillermo', 'Diego', 'Erick', 'Paulo', 'Ignacio', 'Rodrigo', 'Matías', 'Gabriel', 'Lucas'],
    last: ['Sánchez', 'Vidal', 'Aránguiz', 'Bravo', 'Díaz', 'Medel', 'Vargas', 'Mora', 'Isla', 'Brereton', 'Osorio', 'Maripán', 'Pulgar', 'Echeverría', 'Valdés', 'Núñez', 'Suazo', 'Alarcón', 'Cortés', 'Galdames', 'Gutiérrez', 'Loyola', 'Pavez'],
  },
  PER: {
    first: ['Paolo', 'Christian', 'André', 'Renato', 'Yoshimar', 'Pedro', 'Luis', 'Carlos', 'Gianluca', 'Miguel', 'Alex', 'Marcos', 'Wilder', 'Piero', 'Oliver', 'Bryan', 'Raziel', 'Joao', 'Jesús', 'Sergio'],
    last: ['Guerrero', 'Cueva', 'Carrillo', 'Tapia', 'Yotún', 'Gallese', 'Advíncula', 'Zambrano', 'Lapadula', 'Trauco', 'Valera', 'López', 'Cartagena', 'Quispe', 'Sonne', 'Reyna', 'García', 'Grimaldo', 'Castillo', 'Peña', 'Callens', 'Polo', 'Flores'],
  },
  VEN: {
    first: ['Salomón', 'Yeferson', 'Tomás', 'Josef', 'Yangel', 'Darwin', 'Jhon', 'Eduard', 'Rafael', 'Wilker', 'Nahuel', 'Jefferson', 'Cristian', 'Alexander', 'Jon', 'Kervin', 'Telasco', 'Miguel', 'Ronald', 'Luis'],
    last: ['Rondón', 'Soteldo', 'Rincón', 'Martínez', 'Herrera', 'Machís', 'Chancellor', 'Bello', 'Romo', 'Ángel', 'Ferraresi', 'Savarino', 'Cádiz', 'Navarro', 'Aramburu', 'Segovia', 'Andrade', 'González', 'Osorio', 'Casseres', 'Makoun', 'Faríñez', 'Rivas'],
  },
  BOL: {
    first: ['Marcelo', 'Carlos', 'Henry', 'Ramiro', 'Miguel', 'Luis', 'Leonel', 'Diego', 'Jaume', 'Roberto', 'Fernando', 'Moisés', 'Boris', 'Gabriel', 'Víctor', 'Erwin', 'Héctor', 'Rodrigo', 'Juan', 'Ervin'],
    last: ['Martins', 'Lampe', 'Vaca', 'Terceros', 'Villarroel', 'Haquin', 'Justiniano', 'Cuéllar', 'Saucedo', 'Abrego', 'Arce', 'Vaca Díez', 'Fernández', 'Chura', 'Algarañaz', 'Quinteros', 'Ramallo', 'Paz', 'Sagredo', 'Céspedes', 'Bejarano', 'Monteiro', 'Matías'],
  },
});

/** Mesma distribuição de posições dos elencos do JSON (26 jogadores). */
const POSITIONS = ['GOL', 'GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'LAT', 'LAT', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ATA', 'ATA', 'ATA', 'ATA'];

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Um elenco no mesmo formato de `teams[code]` do JSON da Copa. */
export function buildExtraNationalSquad(code) {
  const meta = EXTRA_NATIONAL_TEAMS[code];
  const pool = NAMES[code];
  if (!meta || !pool) return null;
  const rng = seededRandom(hash(`wc-extra:${code}`));
  const used = new Set();
  const nameFor = () => {
    for (let guard = 0; guard < 50; guard += 1) {
      const name = `${pool.first[Math.floor(rng() * pool.first.length)]} ${pool.last[Math.floor(rng() * pool.last.length)]}`;
      if (!used.has(name)) { used.add(name); return name; }
    }
    return `${pool.first[0]} ${pool.last[used.size % pool.last.length]} ${used.size}`;
  };
  const players = POSITIONS.map((pos, index) => ({
    id: `wcx-${code.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
    name: nameFor(),
    pos,
    ovr: 79 + Math.floor(rng() * 10) + (index % 13 === 0 ? 1 : 0),
    nationality: meta.name,
    nationalityIso: meta.iso,
    age: 20 + Math.floor(rng() * 14),
    nationalTeamOnly: true,
  }));
  return {
    code: meta.code,
    name: meta.name,
    iso: meta.iso,
    fifaRank: meta.fifaRank,
    block: meta.block,
    teamPower: nationalTeamPower(meta.block),
    players,
    generated: true,
  };
}

/** Acrescenta ao JSON da Copa os elencos que faltam (não altera os existentes). */
export function withExtraNationalSquads(data) {
  if (!data?.teams) return data;
  const teams = { ...data.teams };
  Object.keys(EXTRA_NATIONAL_TEAMS).forEach(code => {
    if (!teams[code]) teams[code] = buildExtraNationalSquad(code);
  });
  return { ...data, teams };
}
