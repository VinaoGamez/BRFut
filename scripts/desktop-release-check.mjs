import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateDesktopRelease({ version, lockVersion, rootVersion, tag, notes }) {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) throw new Error('Use uma versão estável única, por exemplo 0.2.1.');
  if (lockVersion !== version || rootVersion !== version) throw new Error('package.json e package-lock.json devem ter a mesma versão.');
  if (tag !== `v${version}`) throw new Error(`A tag deve ser v${version}, não ${tag}.`);
  if (typeof notes !== 'string' || notes.trim().length < 40) throw new Error('Escreva as novidades em docs/releases/<versão>.md.');
  return { version, tag, installer: `BR-Fut-${version}-instalador.exe` };
}

export function prepareDesktopRelease(root, { tag, checksums = false } = {}) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const notesPath = join(root, 'docs', 'releases', `${pkg.version}.md`);
  const info = validateDesktopRelease({ version: pkg.version, lockVersion: lock.version, rootVersion: lock.packages?.['']?.version,
    tag: tag || `v${pkg.version}`, notes: existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : '' });
  if (checksums) {
    const installer = join(root, 'release', info.installer);
    if (!existsSync(installer) || statSync(installer).size < 1024 * 1024) throw new Error('Gere o instalador antes de preparar os checksums.');
    const bytes = readFileSync(installer);
    if (bytes.subarray(0, 2).toString('ascii') !== 'MZ') throw new Error('O arquivo não é um executável Windows.');
    const digest = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(root, 'release', 'CHECKSUMS.sha256'), `${digest}  ${basename(installer)}\n`, 'utf8');
    info.sha256 = digest;
  }
  return info;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const info = prepareDesktopRelease(root, { tag: process.argv.slice(2).find(arg => arg.startsWith('v')), checksums: process.argv.includes('--checksums') });
  console.log(JSON.stringify(info, null, 2));
}
