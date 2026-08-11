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

checkSync('login Google consulta endpoint dedicado quando health omite client ID', () => {
  const src = readFileSync(join(ROOT, 'js/core/storage-api.js'), 'utf8');
  const configFlow = src.slice(
    src.indexOf('export async function fetchGoogleAuthConfig'),
    src.indexOf('/** Contagem de cadastros'),
  );
  assert(configFlow.includes("String(health?.googleClientId || '').trim()"), 'normaliza client ID do health');
  assert(configFlow.includes('if (healthClientId)'), 'health só encerra fluxo com client ID válido');
  assert(configFlow.includes("apiUrl('/api/auth/google/config')"), 'mantém fallback no endpoint dedicado');
  assert(
    configFlow.indexOf('if (healthClientId)') < configFlow.indexOf("apiUrl('/api/auth/google/config')"),
    'fallback é executado quando o health não traz client ID',
  );
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

checkSync('identificador interno da carreira não aparece na URL', () => {
  const home = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  assert(!home.includes("url.searchParams.set('slot'"), 'home não adiciona slot na URL');
  assert(!home.includes('index.html?slot='), 'continuar usa URL limpa');
  assert(home.includes("continueBtn.href = 'index.html'"), 'link público não contém identificador');
});

checkSync('sessão persistente exige escolha explícita', () => {
  const account = readFileSync(join(ROOT, 'js/feature/account/index.js'), 'utf8');
  const modal = readFileSync(join(ROOT, 'js/feature/account/modals-html.js'), 'utf8');
  assert(account.includes('rememberEl.checked = isAuthRememberEnabled();'), 'checkbox não inicia marcado');
  assert(account.includes('remember: authRememberChoice()'), 'Google respeita a mesma escolha');
  assert(modal.includes('MANTER CONECTADO NESTE DISPOSITIVO'), 'decisão é clara para o usuário');
});

checkSync('sessão usa cookie HttpOnly e não persiste novos tokens no frontend', () => {
  const authSession = readFileSync(join(ROOT, 'js/core/auth-session.js'), 'utf8');
  const storage = readFileSync(join(ROOT, 'js/core/storage-api.js'), 'utf8');
  const router = readFileSync(join(ROOT, 'scripts/brfut_api/router.py'), 'utf8');
  const cors = readFileSync(join(ROOT, 'scripts/brfut_api/cors.py'), 'utf8');
  assert(authSession.includes("COOKIE_SESSION_MARKER = 'cookie-session'"), 'frontend usa indicador não secreto');
  assert(authSession.includes("credentials: 'include'"), 'requisições enviam cookie da API');
  assert(storage.includes("'/api/auth/session/migrate'"), 'sessões Bearer antigas são migradas');
  assert(storage.includes('persistLegacyAuthToken(body.token'), 'frontend mantém compatibilidade temporária com API antiga');
  assert(router.includes("'token': result['token']") === false, 'API nova não devolve token ao frontend');
  assert(router.includes("'HttpOnly'"), 'cookie não é acessível ao JavaScript');
  assert(router.includes("'SameSite=None'"), 'cookie funciona entre site e API HTTPS');
  assert(router.includes("'X-BRFut-Request'".toLowerCase()) || router.includes('x-brfut-request'), 'API aplica proteção CSRF');
  assert(cors.includes("'Access-Control-Allow-Credentials': 'true'"), 'CORS permite cookie apenas em origens autorizadas');
});

checkSync('páginas públicas aplicam CSP e não exibem diagnóstico interno', () => {
  const homeHtml = readFileSync(join(ROOT, 'home.html'), 'utf8');
  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const home = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  const accountModal = readFileSync(join(ROOT, 'js/feature/account/modals-html.js'), 'utf8');
  assert(homeHtml.includes('Content-Security-Policy'), 'CSP na Home');
  assert(indexHtml.includes('Content-Security-Policy'), 'CSP no jogo');
  assert(!home.includes('storage-diag.html'), 'diagnóstico não é sugerido ao usuário');
  assert(!accountModal.includes('accountProfileDataRoot'), 'caminho do servidor não aparece no perfil');
});

checkSync('boot reutiliza sessão validada e não trata cache parcial como save ausente', () => {
  const storage = readFileSync(join(ROOT, 'js/core/storage-api.js'), 'utf8');
  const validateStart = storage.indexOf('export async function validateAuthenticatedSession');
  const validateEnd = storage.indexOf('export function getSaveSyncStatus', validateStart);
  const validate = storage.slice(validateStart, validateEnd);
  assert(
    validate.includes("const body = await authedFetch('/api/auth/me');"),
    'validação de boot tolera falha transitória',
  );
  assert(
    !validate.includes("if (!token) return { authenticated: false"),
    'cookie HttpOnly precisa ser validado mesmo quando o hint local desaparece',
  );
  assert(
    validate.includes('else if (!token)') && validate.includes('persistAuthSessionHint'),
    'sessão confirmada pela API reconstrói o indicador local',
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
