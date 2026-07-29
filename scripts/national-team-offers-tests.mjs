import assert from 'node:assert/strict';
import { NATIONAL_TEAMS } from '../js/engine/national-teams.js';
import {
  shouldSendNationalTeamOffers,
  shouldIssueNextNationalTeamOffer,
  shouldShowNationalTeamOfferPopup,
  generateNationalTeamOffers,
  generateNextNationalTeamOffer,
  getCurrentNationalTeamProposalTeams,
  repairNationalTeamOfferBatches,
  normalizeNationalTeamOfferState,
  nationalTeamOfferPool,
  NATIONAL_TEAM_OFFER_MONTH,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
  NATIONAL_TEAM_OFFER_WEEK_DAYS,
  WORLD_CUP_2026_YEAR,
} from '../js/engine/national-team-offers.js';

const mar2026 = new Date(2026, NATIONAL_TEAM_OFFER_MONTH, 3, 12);
const feb2026 = new Date(2026, NATIONAL_TEAM_OFFER_MONTH - 1, 28, 12);
const marWeek2 = new Date(2026, NATIONAL_TEAM_OFFER_MONTH, 10, 12);

assert.equal(
  shouldIssueNextNationalTeamOffer({ year: 2026, careerDate: feb2026, offerState: null }),
  false,
  'fevereiro não dispara convites',
);

assert.equal(
  shouldIssueNextNationalTeamOffer({ year: 2026, careerDate: mar2026, offerState: null }),
  true,
  'março dispara 1ª proposta em ano de CMU',
);

assert.equal(
  shouldIssueNextNationalTeamOffer({
    year: 2026,
    careerDate: marWeek2,
    offerState: normalizeNationalTeamOfferState(
      { year: 2026, offers: [{}], issuedCount: 1, lastIssueDate: mar2026.toISOString() },
      2026,
    ),
  }),
  true,
  'após 7 dias libera 2ª proposta',
);

assert.equal(
  shouldIssueNextNationalTeamOffer({
    year: 2026,
    careerDate: new Date(2026, NATIONAL_TEAM_OFFER_MONTH, 5, 12),
    offerState: normalizeNationalTeamOfferState(
      { year: 2026, offers: [{}], issuedCount: 1, lastIssueDate: mar2026.toISOString() },
      2026,
    ),
  }),
  false,
  'antes de 7 dias não libera nova proposta',
);

assert.equal(
  shouldSendNationalTeamOffers({ year: 2026, careerDate: mar2026, offersSentYear: 2026, offerState: null }),
  false,
  'save legado com offersSentYear bloqueia reemissão',
);

const block1Codes = new Set(
  nationalTeamOfferPool({ year: WORLD_CUP_2026_YEAR, userDivision: 'A' }).map(team => team.code),
);
const block2Codes = new Set(
  nationalTeamOfferPool({ year: WORLD_CUP_2026_YEAR, userDivision: 'B' }).map(team => team.code),
);

assert.ok(block1Codes.has('BRA'), 'Série A — pool bloco 1 inclui Brasil');
assert.ok(!block1Codes.has('COL'), 'Série A — pool bloco 1 exclui bloco 2');
assert.ok(block2Codes.has('COL'), 'Série B — pool bloco 2 inclui Colômbia');
assert.ok(!block2Codes.has('BRA'), 'Série B — pool bloco 2 exclui bloco 1');

const serieDPool = nationalTeamOfferPool({ year: 2026, userDivision: 'D' });
assert.equal(serieDPool.length, Object.keys(NATIONAL_TEAMS).length, 'Série D — pool com todas as seleções');

const serieDOffers = generateNationalTeamOffers({
  year: 2026,
  userDivision: 'D',
  seed: 42,
  count: 3,
});
assert.equal(serieDOffers.length, 3, 'Série D gera três convites');
assert.ok(
  serieDOffers.every(offer => serieDPool.some(team => team.code === offer.code)),
  'Série D — convites vêm do pool completo',
);

const first = generateNextNationalTeamOffer({
  year: 2026,
  userDivision: 'D',
  seed: 42,
  issueIndex: 0,
  existingOffers: [],
});
const second = generateNextNationalTeamOffer({
  year: 2026,
  userDivision: 'D',
  seed: 42,
  issueIndex: 1,
  existingOffers: [first],
});
assert.equal(first?.teams?.length, NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL, 'cada proposta traz 3 seleções');
assert.equal(second?.teams?.length, NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL, '2ª proposta também traz 3 seleções');
const firstCodes = new Set(first.teams.map(team => team.code));
const secondCodes = new Set(second.teams.map(team => team.code));
assert.ok(firstCodes.size === NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL, 'proposta 1 — seleções distintas');
assert.ok([...secondCodes].every(code => !firstCodes.has(code)), 'propostas semanais não repetem seleções');

assert.equal(
  getCurrentNationalTeamProposalTeams([first]).length,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
  'popup exibe as 3 seleções da proposta atual',
);

const legacyFlat = {
  year: 2026,
  offers: [{ id: 'nt-BRA-1-1', code: 'BRA', name: 'Brasil', fifaRank: 6, contractLabel: 'Copa do Mundo 2026' }],
  issuedCount: 1,
  lastIssueDate: mar2026.toISOString(),
  snoozedUntil: null,
};
const repaired = repairNationalTeamOfferBatches(legacyFlat, { year: 2026, userDivision: 'D', seed: 42 });
assert.equal(repaired.changed, true, 'save legado é migrado para lote de 3');
assert.equal(
  getCurrentNationalTeamProposalTeams(repaired.state.offers).length,
  NATIONAL_TEAM_OFFER_TEAMS_PER_PROPOSAL,
  'save legado passa a exibir 3 seleções',
);

const popupState = normalizeNationalTeamOfferState(
  {
    year: 2026,
    offers: [first],
    issuedCount: 1,
    lastIssueDate: mar2026.toISOString(),
    snoozedUntil: new Date(2026, NATIONAL_TEAM_OFFER_MONTH, 8, 12).toISOString(),
  },
  2026,
);
assert.equal(
  shouldShowNationalTeamOfferPopup({ year: 2026, careerDate: mar2026, offerState: popupState }),
  false,
  'negar todos adia popup até snoozedUntil',
);

assert.equal(NATIONAL_TEAM_OFFER_WEEK_DAYS, 7, 'intervalo semanal de 7 dias');

console.log('national-team-offers-tests: ok');
