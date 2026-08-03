/**
 * Simulações do fluxo: home (COMEÇAR CARREIRA) → login → index com save.
 * Rode com o tester-server ativo: py scripts/tester-server.py --port 5081
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.BRFUT_TEST_ORIGIN || 'http://127.0.0.1:5081';

let passed = 0;
let failed = 0;

const assert = (cond, message) => {
  if (!cond) throw new Error(message || 'assertion failed');
};

const checkSync = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

const checkAsync = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(`  ${error.message}`);
  }
};

checkSync('index sem token redireciona para home.html', () => {
  const src = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  assert(src.includes('redirectToHomeLanding'), 'função de redirect para home');
  assert(src.includes("new URL('home.html'"), 'destino home.html');
  assert(!src.includes('injectPreLoginWelcome'), 'sem overlay ENTRAR no index');
  assert(!src.includes("closest('#welcomeLogin')"), 'index não abre login direto');
});

checkSync('home abre login em COMEÇAR CARREIRA', () => {
  const src = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  assert(src.includes("loginBtn?.addEventListener('click', () => account.openLogin())"), 'botão home abre login');
});

checkSync('openLogin não fecha modal ao preparar formulário', () => {
  const src = readFileSync(join(ROOT, 'js/feature/account/index.js'), 'utf8');
  const openLogin = src.slice(src.indexOf('const openLogin'), src.indexOf('const refresh = async'));
  assert(openLogin.includes('keepModalOpen: true'), 'renderLoggedOut mantém modal aberto');
});

checkSync('navegação interna preserva sessão (skip session end)', () => {
  const save = readFileSync(join(ROOT, 'js/core/save.js'), 'utf8');
  const dom = readFileSync(join(ROOT, 'js/ui/dom.js'), 'utf8');
  const persist = readFileSync(join(ROOT, 'js/engine/career-persistence.js'), 'utf8');
  const home = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  assert(save.includes('markSkipSessionEndOnce'), 'helper mark skip session');
  assert(save.includes('consumeSkipSessionEndOnce'), 'helper consume skip session');
  assert(dom.includes('markSkipSessionEndOnce'), 'redirectGame marca skip');
  assert(persist.includes('shouldPreserveAuthOnPageHide'), 'persistência respeita preservação da sessão');
  assert(
    persist.includes('hasLocalCareerSave') && persist.includes('markCareerReloadPending'),
    'pagehide usa localStorage e marca reload pendente',
  );
  assert(home.includes('markSkipSessionEndOnce'), 'home marca skip ao ir para o jogo');
  assert(
    home.includes('hasCareer() || hasLocalCareerSave() || getAuthToken()'),
    'home pagehide marca skip com save local',
  );
});

checkSync('home e index encerram sessão ao fechar aba', () => {
  const home = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  const main = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  assert(home.includes('endBrowserSession'), 'home pagehide logout');
  assert(main.includes('endBrowserSession'), 'index pagehide logout');
});

checkSync('home keeps authenticated state when slots render again', () => {
  const src = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  assert(src.includes('let authUiState = {'), 'persistent auth state on Home');
  assert(
    src.includes('onSlotsChanged: () => syncCareerActions(authUiState)'),
    'slot render reuses authenticated state',
  );
  assert(src.includes('recoverCareerSlotsAfterHydration();'), 'recovery runs after cloud hydrate');
});

checkSync('boot reutiliza sessão validada e não trata cache parcial como save ausente', () => {
  const storage = readFileSync(join(ROOT, 'js/core/storage-api.js'), 'utf8');
  const validateStart = storage.indexOf('export async function validateAuthenticatedSession');
  const validateEnd = storage.indexOf('export function getSaveSyncStatus', validateStart);
  const validate = storage.slice(validateStart, validateEnd);
  assert(
    validate.includes("authedFetch('/api/auth/me')") && !validate.includes('retry: false'),
    'validação de boot tolera falha transitória',
  );
  assert(
    storage.includes('if (!cloudActive || !currentUser) {'),
    'hidratação não repete /auth/me depois de sessão confirmada',
  );
  const fetchKeyStart = storage.indexOf('export async function fetchRemoteSaveKey');
  const fetchKeyEnd = storage.indexOf('export async function mergeSlotBundleFromCloud', fetchKeyStart);
  const fetchKey = storage.slice(fetchKeyStart, fetchKeyEnd);
  assert(
    fetchKey.includes('if (cached !== undefined) return cached;'),
    'cache miss consulta endpoint individual do bundle',
  );
  assert(fetchKey.includes('authedFetch(`/api/saves/'), 'fallback remoto continua disponível');
});

checkSync('tela de notas pós-jogo oculta estatísticas e preserva relatórios históricos', () => {
  const calendar = readFileSync(join(ROOT, 'js/feature/calendar-view/index.js'), 'utf8');
  const engine = readFileSync(join(ROOT, 'js/legacy/engine.js'), 'utf8');
  assert(
    calendar.includes('(entry, { showStatistics = true } = {})'),
    'relatórios históricos continuam exibindo estatísticas por padrão',
  );
  assert(
    calendar.includes("header + (showStatistics ? statisticsHtml : '') + ratingsHtml"),
    'renderização permite ocultar somente as estatísticas',
  );
  assert(
    engine.includes('}, { showStatistics: false });'),
    'botão NOTAS do pós-jogo solicita relatório sem estatísticas',
  );
});

await checkAsync(`GET ${BASE}/home.html responde`, async () => {
  const res = await fetch(`${BASE}/home.html`, { cache: 'no-store' });
  assert(res.ok, `HTTP ${res.status}`);
  const html = await res.text();
  assert(html.includes('loginBtn'), 'botão COMEÇAR CARREIRA');
  assert(html.includes('COMEÇAR CARREIRA'), 'texto do botão principal');
});

await checkAsync(`GET ${BASE}/api/health responde ok`, async () => {
  const res = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
  assert(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert(body?.ok === true, 'health ok');
});

await checkAsync('bundle main redireciona para home sem token', async () => {
  const indexRes = await fetch(`${BASE}/index.html`, { cache: 'no-store' });
  const html = await indexRes.text();
  const match = html.match(/assets\/main-[A-Za-z0-9_-]+\.js/);
  assert(match, 'script main no index');
  const jsRes = await fetch(`${BASE}/${match[0]}`, { cache: 'no-store' });
  const js = await jsRes.text();
  assert(js.includes('home.html'), 'bundle referencia home.html');
  assert(!js.includes('injectPreLoginWelcome'), 'sem welcome login no index');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
