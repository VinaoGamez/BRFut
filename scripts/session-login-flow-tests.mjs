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

checkSync('home e index encerram sessão ao fechar aba', () => {
  const home = readFileSync(join(ROOT, 'js/home.js'), 'utf8');
  const main = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  assert(home.includes('endBrowserSession'), 'home pagehide logout');
  assert(main.includes('endBrowserSession'), 'index pagehide logout');
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
