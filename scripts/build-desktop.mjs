/**
 * Gera o instalador desktop do BR Fut.
 *
 * Monta o `dist/` com as variáveis de modo offline embutidas e depois chama o
 * electron-builder. As variáveis vêm do mesmo lugar do
 * `INICIAR-BRFUT-OFFLINE-BUILD.bat`: um app desktop não tem API nem VPS, então
 * precisa nascer sem elas.
 *
 *   node scripts/build-desktop.mjs           -> instalador .exe (NSIS)
 *   node scripts/build-desktop.mjs --dir     -> só a pasta, sem instalador
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv.includes('--dir');
const SKIP_BUILD = process.argv.includes('--skip-build');

const OFFLINE = {
  BRFUT_AUTH_REQUIRED: 'false',
  BRFUT_API_ORIGIN: '',
  BRFUT_LOCAL_API_TARGET: 'http://127.0.0.1:9/',
};

/**
 * Roda um entrypoint JS local com o próprio Node do processo.
 *
 * Não usa `npx` nem `shell: true`: o Node 24 bloqueia `spawnSync` de `.cmd`
 * (mitigação de CVE-2024-27980) e `shell: true` concatena argumento sem
 * escapar, o que quebra com caminho de projeto que contenha espaço — e este
 * projeto está em "D:\BR FUT".
 */
function rodarNo(caminhoRelativo, args, extraEnv = {}) {
  const alvo = join(RAIZ, caminhoRelativo);
  if (!existsSync(alvo)) {
    console.error(`\nDependência ausente: ${caminhoRelativo}. Rode "npm install" primeiro.`);
    process.exit(1);
  }
  process.stdout.write(`\n> node ${caminhoRelativo} ${args.join(' ')}\n`);
  const r = spawnSync(process.execPath, [alvo, ...args], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (r.error) {
    console.error(`\nFALHOU ao executar ${caminhoRelativo}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`\nFALHOU: ${caminhoRelativo} (código ${r.status})`);
    process.exit(r.status || 1);
  }
}

/**
 * Ícone do app.
 *
 * electron-builder aceita um PNG de 256x256 em `build/icon.png` e converte. Sem
 * ele o instalador sai com o ícone padrão do Electron, que é o menor detalhe
 * que faz um instalador parecer profissional.
 */
function prepararIcone() {
  const destinoDir = join(RAIZ, 'electron', 'build');
  mkdirSync(destinoDir, { recursive: true });
  // O builder exige no mínimo 256x256. `mark-favicon.png` serve para a aba do
  // navegador e é pequeno demais, então as marcas grandes vêm primeiro.
  const candidatos = [
    join(RAIZ, 'public', 'brand', 'mark-lg.png'),
    join(RAIZ, 'public', 'brand', 'mark-512.png'),
    join(RAIZ, 'public', 'brand', 'mark.png'),
    join(RAIZ, 'public', 'brand', 'mark-favicon.png'),
  ];
  const origem = candidatos.find(p => existsSync(p));
  if (!origem) {
    console.log('  (sem marca própria em public/brand — seguindo com o ícone padrão do Electron)');
    return false;
  }
  // Valida o PNG: magic bytes 89 50 4E 47. Um .ico renomeado quebra o builder.
  const buf = readFileSync(origem);
  const ehPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!ehPng) {
    console.log(`  ${origem.split(/[\\/]/).pop()} não é PNG válido — usando ícone padrão`);
    return false;
  }
  // Mede as dimensões sem dependência externa:IHDR do PNG tem largura e altura
  // em big-endian nos bytes 16..24.
  const largura = buf.readUInt32BE(16);
  const altura = buf.readUInt32BE(20);
  if (largura < 256 || altura < 256) {
    console.log(`  ${origem.split(/[\\/]/).pop()} tem ${largura}x${altura} — abaixo de 256x256, ícone padrão`);
    return false;
  }
  copyFileSync(origem, join(destinoDir, 'icon.png'));
  console.log(`  ícone: ${origem.split(/[\\/]/).pop()} (${largura}x${altura}) -> electron/build/icon.png`);
  return true;
}

/** electron-builder falha se o campo `main` apontar para arquivo inexistente. */
function verificarEntrada() {
  const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  const main = join(RAIZ, pkg.main || '');
  if (!existsSync(main)) {
    console.error(`package.json.main aponta para ${pkg.main}, que não existe.`);
    process.exit(1);
  }
  if (!existsSync(join(RAIZ, 'electron', 'preload.cjs'))) {
    console.error('electron/preload.cjs não existe.');
    process.exit(1);
  }
  console.log(`  entrada: ${pkg.main}`);
}

console.log('=== BR Fut · empacotamento desktop ===\n');
verificarEntrada();
prepararIcone();

if (!SKIP_BUILD) {
  console.log('\n[1/2] build do jogo (modo offline embutido)');
  rodarNo(join('node_modules', 'vite', 'bin', 'vite.js'), ['build'], OFFLINE);
  const dist = join(RAIZ, 'dist', 'home.html');
  if (!existsSync(dist)) {
    console.error(`\nO build não gerou ${dist}.`);
    process.exit(1);
  }
} else {
  console.log('\n[1/2] build pulado (--skip-build)');
}

console.log(`\n[2/2] electron-builder (${DIR ? 'pasta apenas' : 'instalador NSIS'})`);
rodarNo(
  join('node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
  DIR ? ['--win', '--dir'] : ['--win', 'nsis'],
);

console.log('\n=== pronto ===');
console.log(`Instalador em: ${join(RAIZ, 'release')}`);
writeFileSync(join(RAIZ, 'electron', 'build', '.built'), new Date().toISOString());