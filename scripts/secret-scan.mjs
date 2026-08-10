/**
 * Varredura de alta confiança nos arquivos rastreados pelo Git.
 * Não imprime o conteúdo encontrado para evitar vazar um segredo no log do CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const MAX_FILE_BYTES = 2_000_000;
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.mp3', '.wav',
  '.woff', '.woff2', '.ttf', '.pdf', '.docx', '.zip', '.gz',
]);

const PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['google-api-key', /AIza[0-9A-Za-z_-]{30,}/],
  ['github-token', /(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,})/],
  ['openai-key', /sk-[A-Za-z0-9_-]{20,}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['jwt', /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/],
];

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const findings = [];

for (const file of tracked) {
  if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
  try {
    if (statSync(file).size > MAX_FILE_BYTES) continue;
    const content = readFileSync(file, 'utf8');
    for (const [kind, pattern] of PATTERNS) {
      if (pattern.test(content)) findings.push({ file, kind });
    }
  } catch {
    // Arquivo removido durante a execução ou não textual: ignorar.
  }
}

if (findings.length) {
  console.error('Possíveis segredos encontrados (conteúdo ocultado):');
  for (const finding of findings) console.error(`- ${finding.file} [${finding.kind}]`);
  process.exit(1);
}

console.log(`✓ ${tracked.length} arquivos rastreados verificados; nenhum segredo de alta confiança encontrado.`);
