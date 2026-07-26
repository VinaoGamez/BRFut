/**
 * Clubes reais por UF — base para origem estadual na nova carreira.
 * division: A|B|C|D na pirâmide nacional; REG = base regional (fora da pirâmide).
 */

import { getCustomClubsForRegistry, getCustomClubByName, getCustomClubsCacheVersion } from './custom-clubs.js';

export const BRAZILIAN_UFS = Object.freeze([
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
]);

/** Série A seed (sem clube do usuário). */
export const SERIE_A_SEED = Object.freeze([
  'Palmeiras',
  'Flamengo',
  'Grêmio',
  'Cruzeiro',
  'Bahia',
  'São Paulo',
  'Internacional',
  'Botafogo',
  'Corinthians',
  'Vasco',
  'Santos',
  'Fluminense',
  'Athletico PR',
  'Bragantino',
  'Atlético-MG',
  'Mirassol',
  'Remo',
  'Vitória',
  'Coritiba',
  'Chapecoense',
]);

/** @type {ReadonlyArray<{ name: string, uf: string, division: 'A'|'B'|'C'|'D'|'REG' }>} */
export const REAL_CLUBS_BY_UF = Object.freeze([
  // SP
  { name: 'Palmeiras', uf: 'SP', division: 'A' },
  { name: 'São Paulo', uf: 'SP', division: 'A' },
  { name: 'Corinthians', uf: 'SP', division: 'A' },
  { name: 'Santos', uf: 'SP', division: 'A' },
  { name: 'Bragantino', uf: 'SP', division: 'A' },
  { name: 'Ponte Preta', uf: 'SP', division: 'B' },
  { name: 'Guarani', uf: 'SP', division: 'C' },
  { name: 'Novorizontino', uf: 'SP', division: 'B' },
  { name: 'Portuguesa', uf: 'SP', division: 'D' },
  { name: 'Ituano', uf: 'SP', division: 'C' },
  { name: 'Mirassol', uf: 'SP', division: 'A' },
  { name: 'São Bento', uf: 'SP', division: 'REG' },
  // RJ
  { name: 'Flamengo', uf: 'RJ', division: 'A' },
  { name: 'Fluminense', uf: 'RJ', division: 'A' },
  { name: 'Botafogo', uf: 'RJ', division: 'A' },
  { name: 'Vasco', uf: 'RJ', division: 'A' },
  { name: 'Volta Redonda', uf: 'RJ', division: 'C' },
  { name: 'Nova Iguaçu', uf: 'RJ', division: 'D' },
  { name: 'Madureira', uf: 'RJ', division: 'REG' },
  { name: 'Boavista', uf: 'RJ', division: 'REG' },
  // MG
  { name: 'Cruzeiro', uf: 'MG', division: 'A' },
  { name: 'Atlético-MG', uf: 'MG', division: 'A' },
  { name: 'América-MG', uf: 'MG', division: 'B' },
  { name: 'Villa Nova', uf: 'MG', division: 'REG' },
  { name: 'Tombense', uf: 'MG', division: 'REG' },
  { name: 'Caldense', uf: 'MG', division: 'REG' },
  // RS
  { name: 'Grêmio', uf: 'RS', division: 'A' },
  { name: 'Internacional', uf: 'RS', division: 'A' },
  { name: 'Juventude', uf: 'RS', division: 'B' },
  { name: 'Caxias', uf: 'RS', division: 'C' },
  { name: 'Ypiranga', uf: 'RS', division: 'C' },
  { name: 'São Luiz', uf: 'RS', division: 'D' },
  // PR
  { name: 'Athletico PR', uf: 'PR', division: 'A' },
  { name: 'Coritiba', uf: 'PR', division: 'A' },
  { name: 'Londrina', uf: 'PR', division: 'B' },
  { name: 'Operário PR', uf: 'PR', division: 'B' },
  { name: 'Cascavel', uf: 'PR', division: 'D' },
  // SC
  { name: 'Chapecoense', uf: 'SC', division: 'A' },
  { name: 'Avai', uf: 'SC', division: 'B' },
  { name: 'Criciúma', uf: 'SC', division: 'B' },
  { name: 'Joinville', uf: 'SC', division: 'REG' },
  { name: 'Brusque', uf: 'SC', division: 'C' },
  { name: 'Marcílio Dias', uf: 'SC', division: 'D' },
  // BA
  { name: 'Bahia', uf: 'BA', division: 'A' },
  { name: 'Vitória', uf: 'BA', division: 'A' },
  { name: 'Juazeirense', uf: 'BA', division: 'D' },
  { name: 'Jacobina', uf: 'BA', division: 'REG' },
  // PE
  { name: 'Sport', uf: 'PE', division: 'B' },
  { name: 'Náutico', uf: 'PE', division: 'B' },
  { name: 'Santa Cruz', uf: 'PE', division: 'C' },
  { name: 'Retrô', uf: 'PE', division: 'REG' },
  { name: 'Afogados', uf: 'PE', division: 'REG' },
  // CE
  { name: 'Fortaleza', uf: 'CE', division: 'B' },
  { name: 'Ceará', uf: 'CE', division: 'B' },
  { name: 'Ferroviário', uf: 'CE', division: 'D' },
  { name: 'Floresta', uf: 'CE', division: 'C' },
  // GO
  { name: 'Goiás', uf: 'GO', division: 'B' },
  { name: 'Vila Nova', uf: 'GO', division: 'B' },
  { name: 'Aparecidense', uf: 'GO', division: 'D' },
  { name: 'Estrela do Cerrado', uf: 'GO', division: 'REG' },
  { name: 'Anápolis', uf: 'GO', division: 'C' },
  // MT
  { name: 'Cuiabá', uf: 'MT', division: 'B' },
  { name: 'Operário VG', uf: 'MT', division: 'D' },
  { name: 'Luverdense', uf: 'MT', division: 'D' },
  // MS
  { name: 'Operário MS', uf: 'MS', division: 'D' },
  { name: 'Corumbaense', uf: 'MS', division: 'REG' },
  // ES
  { name: 'Vitória ES', uf: 'ES', division: 'D' },
  { name: 'Rio Branco ES', uf: 'ES', division: 'D' },
  // DF
  { name: 'Brasiliense', uf: 'DF', division: 'D' },
  { name: 'Real Brasília', uf: 'DF', division: 'REG' },
  // PA
  { name: 'Paysandu', uf: 'PA', division: 'C' },
  { name: 'Remo', uf: 'PA', division: 'A' },
  { name: 'Tuna Luso', uf: 'PA', division: 'REG' },
  // AM
  { name: 'Amazonas', uf: 'AM', division: 'C' },
  { name: 'Manauara', uf: 'AM', division: 'D' },
  // RN
  { name: 'ABC', uf: 'RN', division: 'D' },
  { name: 'América RN', uf: 'RN', division: 'D' },
  { name: 'Potiguar', uf: 'RN', division: 'REG' },
  // PB
  { name: 'Campinense', uf: 'PB', division: 'REG' },
  { name: 'Treze', uf: 'PB', division: 'D' },
  // AL
  { name: 'CSA', uf: 'AL', division: 'D' },
  { name: 'CRB', uf: 'AL', division: 'B' },
  { name: 'Murici', uf: 'AL', division: 'REG' },
  // SE
  { name: 'Confiança', uf: 'SE', division: 'C' },
  { name: 'Itabaiana', uf: 'SE', division: 'C' },
  // MA
  { name: 'Sampaio Corrêa', uf: 'MA', division: 'REG' },
  { name: 'Imperatriz', uf: 'MA', division: 'D' },
  { name: 'Maranhão', uf: 'MA', division: 'C' },
  // PI
  { name: 'Flamengo PI', uf: 'PI', division: 'REG' },
  { name: 'Parnahyba', uf: 'PI', division: 'D' },
  // TO
  { name: 'Tocantinópolis', uf: 'TO', division: 'D' },
  { name: 'Palmas', uf: 'TO', division: 'REG' },
  // RO
  { name: 'Porto Velho', uf: 'RO', division: 'D' },
  { name: 'Ji-Paraná', uf: 'RO', division: 'REG' },
  // AC
  { name: 'Rio Branco AC', uf: 'AC', division: 'REG' },
  { name: 'Galvez', uf: 'AC', division: 'D' },
  // RR
  { name: 'São Raimundo RR', uf: 'RR', division: 'D' },
  { name: 'GAS', uf: 'RR', division: 'D' },
  // AP
  { name: 'Santos AP', uf: 'AP', division: 'REG' },
  { name: 'Trem', uf: 'AP', division: 'D' },
]);

const REAL_CLUB_INDEX = Object.freeze(
  REAL_CLUBS_BY_UF.reduce((map, club) => {
    map.set(normClubName(club.name), club);
    return map;
  }, new Map()),
);

/** @type {ReturnType<typeof getAllRealClubs>|null} */
let allRealClubsCache = null;
let allRealClubsCacheVersion = -1;

/**
 * Mescla clubes do import Brasfoot (pirâmide oficial) no registry em memória.
 * @param {object[] | null | undefined} importClubs
 */
export function hydrateRealClubsFromImport(importClubs) {
  if (!Array.isArray(importClubs) || !importClubs.length) return;
  const version = getCustomClubsCacheVersion();
  const builtInKeys = new Set(REAL_CLUBS_BY_UF.map(club => normClubName(club.name)));
  const fromImport = importClubs
    .filter(
      club =>
        club?.country === 'BRA'
        && club?.name
        && club?.uf
        && ['A', 'B', 'C', 'D', 'REG'].includes(club.division),
    )
    .map(club => ({
      name: club.name,
      uf: String(club.uf).toUpperCase(),
      division: club.division,
    }));
  const custom = getCustomClubsForRegistry().filter(club => !builtInKeys.has(normClubName(club.name)));
  const merged = new Map();
  for (const club of [...REAL_CLUBS_BY_UF, ...fromImport, ...custom]) {
    merged.set(normClubName(club.name), club);
  }
  allRealClubsCache = [...merged.values()];
  allRealClubsCacheVersion = version;
}

/** Registry base + clubes do Lab de Times (localStorage). */
export function getAllRealClubs() {
  const version = getCustomClubsCacheVersion();
  if (allRealClubsCache && allRealClubsCacheVersion === version) return allRealClubsCache;
  const builtInKeys = new Set(REAL_CLUBS_BY_UF.map(club => normClubName(club.name)));
  const custom = getCustomClubsForRegistry().filter(club => !builtInKeys.has(normClubName(club.name)));
  allRealClubsCache = [...REAL_CLUBS_BY_UF, ...custom];
  allRealClubsCacheVersion = version;
  return allRealClubsCache;
}

export function normClubName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

export function getRealClub(name) {
  return REAL_CLUB_INDEX.get(normClubName(name)) || getCustomClubByName(name) || null;
}

export function isRegisteredRealClub(name) {
  return REAL_CLUB_INDEX.has(normClubName(name)) || !!getCustomClubByName(name);
}

/** Valor do select de origem para listar clubes de todos os estados. */
export const ALL_ORIGIN_UF = 'ALL';

const sortClubsForOriginList = (a, b, groupByUf = false) => {
  if (groupByUf) {
    const ufDiff = a.uf.localeCompare(b.uf, 'pt-BR');
    if (ufDiff !== 0) return ufDiff;
  }
  const order = { A: 0, B: 1, C: 2, D: 3, REG: 4 };
  const divDiff = (order[a.division] ?? 9) - (order[b.division] ?? 9);
  if (divDiff !== 0) return divDiff;
  return a.name.localeCompare(b.name, 'pt-BR');
};

export function listClubsByUf(ufCode) {
  const uf = String(ufCode || '').trim().toUpperCase();
  const all = getAllRealClubs();
  if (uf === ALL_ORIGIN_UF) {
    return [...all].sort((a, b) => sortClubsForOriginList(a, b, true));
  }
  return all.filter(club => club.uf === uf).sort((a, b) => sortClubsForOriginList(a, b, false));
}

export function resolveOriginUfForCareer(originUf, hostClub) {
  const code = String(originUf || '').trim().toUpperCase();
  if (code === ALL_ORIGIN_UF) return hostClub?.uf || 'SP';
  return code || hostClub?.uf || 'SP';
}

export function divisionLabel(division) {
  switch (division) {
    case 'A':
      return 'Série A';
    case 'B':
      return 'Série B';
    case 'C':
      return 'Série C';
    case 'D':
      return 'Série D';
    case 'REG':
      return 'Base regional';
    default:
      return '—';
  }
}

export function careerDivisionForHost(hostClub) {
  if (!hostClub) return 'A';
  return hostClub.division === 'REG' ? 'D' : hostClub.division;
}

export function stateCompetitionIdForUf(ufCode) {
  const uf = String(ufCode || '').trim().toLowerCase();
  return uf ? `state_league_${uf}` : null;
}

export function pickRandomHostClub(clubs, random = Math.random) {
  if (!Array.isArray(clubs) || !clubs.length) return null;
  const index = Math.floor(random() * clubs.length);
  return clubs[index] || null;
}
