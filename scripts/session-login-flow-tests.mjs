/**
 * Simulações do fluxo: abrir site → tela ENTRAR → modal de login → API.
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

checkSync('main.js abre modal antes do health check', () => {
  const src = readFileSync(join(ROOT, 'js/feature/account/index.js'), 'utf8');
  const openLogin = src.slice(src.indexOf('const openLogin'), src.indexOf('const refresh = async'));
  assert(openLogin.includes('openModal();'), 'openModal deve ser chamado no início de openLogin');
  assert(
    openLogin.indexOf('openModal();') < openLogin.indexOf('fetchBackendHealth'),
    'openModal deve vir antes de fetchBackendHealth',
  );
});

checkSync('main.js delega clique em #welcomeLogin', () => {
  const src = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  assert(src.includes("closest('#welcomeLogin')"), 'delegação de clique no welcomeLogin');
  assert(src.includes('account.openLogin'), 'delegação chama account.openLogin');
});

checkSync('ensureAccountModals garante #accountModal no DOM', () => {
  const src = readFileSync(join(ROOT, 'js/feature/account/inject-modals.js'), 'utf8');
  assert(src.includes('accountModal'), 'verifica accountModal');
  assert(src.includes('ensureAccountModals'), 'exporta ensureAccountModals');
});

checkSync('beginAppSession oculta splash sem boot quando sem token', () => {
  const src = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  assert(src.includes('if (!bootStarted) markBootReady()'), 'markBootReady quando motor não sobe');
  assert(src.includes('injectPreLoginWelcome'), 'injeta tela ENTRAR');
});

checkSync('modal de login fica acima da welcome (CSS)', () => {
  const css = readFileSync(join(ROOT, 'css/account-modal.css'), 'utf8');
  assert(css.includes('body.account-login-open #accountModal'), 'z-index elevado no login');
  assert(css.includes('pointer-events: none'), 'welcome não bloqueia cliques no modal');
});

await checkAsync(`GET ${BASE}/index.html responde`, async () => {
  const res = await fetch(`${BASE}/index.html`, { cache: 'no-store' });
  assert(res.ok, `HTTP ${res.status}`);
  const html = await res.text();
  assert(html.includes('bootSplash'), 'splash de boot presente');
  assert(html.includes('Carregando'), 'texto de carregamento presente');
});

await checkAsync(`GET ${BASE}/api/health responde ok`, async () => {
  const res = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
  assert(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert(body?.ok === true, 'health ok');
  assert(body?.service === 'brfut-api', 'service brfut-api');
});

await checkAsync('bundle main expõe fluxo de sessão (build dist)', async () => {
  const indexRes = await fetch(`${BASE}/index.html`, { cache: 'no-store' });
  const html = await indexRes.text();
  const match = html.match(/assets\/main-[A-Za-z0-9_-]+\.js/);
  assert(match, 'script main no index');
  const jsRes = await fetch(`${BASE}/${match[0]}`, { cache: 'no-store' });
  assert(jsRes.ok, 'bundle main acessível');
  const js = await jsRes.text();
  assert(js.includes('welcomeLogin'), 'bundle referencia welcomeLogin');
  assert(js.includes('account-login-open') || js.includes('openLogin'), 'bundle inclui login flow');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
