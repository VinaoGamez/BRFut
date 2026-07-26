#!/usr/bin/env node
/**
 * Gera public/clubs/{slug}.svg a partir de js/engine/club-crests.js
 * Uso: node scripts/generate-club-crests.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUB_CREST_ARTWORK, buildClubCrestSvg } from '../js/engine/club-crests.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'clubs');

const EXTRA = {
  vitoria: { slug: 'vitoria', name: 'Vitória', primary: '#E31E24', secondary: '#000000', pattern: 'horizontal' },
  'america-mg': { slug: 'america-mg', name: 'América-MG', primary: '#006B3F', secondary: '#000000', pattern: 'vertical' },
  'atletico-mg': { slug: 'atletico-mg', name: 'Atlético-MG', primary: '#000000', secondary: '#ffffff', pattern: 'vertical' },
  cuiaba: { slug: 'cuiaba', name: 'Cuiabá', primary: '#006B3F', secondary: '#FFD100', pattern: 'vertical' },
  sport: { slug: 'sport', name: 'Sport', primary: '#E31E24', secondary: '#000000', pattern: 'vertical' },
};

mkdirSync(outDir, { recursive: true });

const artwork = { ...CLUB_CREST_ARTWORK, ...EXTRA };
let count = 0;
for (const entry of Object.values(artwork)) {
  const svg = buildClubCrestSvg(entry.name, entry);
  writeFileSync(join(outDir, `${entry.slug}.svg`), svg, 'utf8');
  count += 1;
}

console.log(`Generated ${count} club crests in public/clubs/`);
