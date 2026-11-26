/**
 * Contrato de editabilidade dos formulários de jogo.
 *
 * Campos que recebem entrada do jogador não podem nascer bloqueados nem receber
 * CSS que capture o ponteiro. Bloqueios de ações do jogo continuam sendo feitos
 * em botões e selects sem opções disponíveis.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const index = read('index.html');
const transfers = read('js/feature/transfers/index.js');
const economy = read('js/feature/economy/index.js');
const options = read('js/feature/options/index.js');
const account = read('js/feature/account/modals-html.js');
const accountFeature = read('js/feature/account/index.js');
const testerHardening = read('js/security/tester-hardening.js');
const transfersCss = read('css/transfers.css');

const editableTags = index.match(/<(?:input|textarea|select)\b[^>]*>/gi) || [];
const blocked = editableTags.filter(tag => /\s(?:disabled|readonly)(?:\s|=|>|\/)/i.test(tag));
assert.deepEqual(blocked, [], `Controle editável inicial bloqueado: ${blocked.join(' | ')}`);

const marketInputs = [
  'transfersFilterOvr', 'transfersFilterMaxOvr', 'transfersFilterMinAge',
  'transfersFilterMaxAge', 'transfersFilterMaxPrice', 'transfersFilterMaxWage',
  'transfersSellFilterOvr', 'transfersSellFilterMaxOvr', 'transfersSellFilterMinAge',
  'transfersSellFilterMaxAge', 'transfersSellFilterMaxPrice', 'transfersSellFilterMaxWage',
];
for (const id of marketInputs) {
  const tag = editableTags.find(value => new RegExp(`id=["']${id}["']`, 'i').test(value));
  assert.ok(tag, `Campo do Mercado ausente: ${id}`);
  assert.match(tag, /type=["']text["']/i, `${id} deve aceitar digitação livre`);
  assert.match(tag, /inputmode=["']numeric["']/i, `${id} deve abrir teclado numérico quando disponível`);
}
assert.match(transfers, /const readFilterNumber\s*=/, 'Mercado deve normalizar texto numérico ao pesquisar');
assert.match(transfers, /bindSearchInputs\('#transfersBuyPanel input, #transfersBuyPanel select'/);
assert.match(transfers, /input\.readOnly = false;\s*input\.disabled = false;/);
assert.doesNotMatch(transfersCss, /\.transfers-field\s+input[^{}]*\{[^}]*pointer-events\s*:\s*none/is);

// Formulários criados após o boot também precisam manter campos editáveis.
for (const [source, ids] of [
  [options, ['careerClubName', 'careerManagerName', 'careerStadiumName']],
  [account, ['accountUsername', 'accountPassword', 'accountDisplayName', 'accountProfileDisplayName']],
  [economy, ['officeBankLoanAmount']],
]) {
  for (const id of ids) {
    const from = source.indexOf(`id=\"${id}\"`);
    assert.notEqual(from, -1, `Campo dinâmico ausente: ${id}`);
    const tag = source.slice(from, source.indexOf('>', from) + 1);
    assert.doesNotMatch(tag, /\b(?:disabled|readonly)\b/i, `Campo dinâmico bloqueado: ${id}`);
  }
}

assert.match(accountFeature, /const usernameEl = \$\('#accountUsername'\)/);
assert.match(economy, /loanBody\.addEventListener\('input'/);
assert.match(testerHardening, /input, html\.tester-hardened textarea, html\.tester-hardened \[contenteditable="true"\]/);
assert.match(testerHardening, /user-select: text/);

console.log(`form-editability: ${editableTags.length} controles iniciais e formulários dinâmicos verificados`);
