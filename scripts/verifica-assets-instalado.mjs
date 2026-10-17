/**
 * Confere, no app INSTALADO, que as imagens que o jogo realmente pede são
 * servidas com 200 e conteúdo não vazio.
 *
 * Por que isto existe: a conversão de PNG para WebP reescreve as referências
 * nos fontes. Um caminho errado não gera erro de console nem exceção — vira
 * `<img>` com `naturalWidth === 0`, ou seja, um retângulo vazio na tela. Só
 * pedindo o arquivo dá para saber.
 *
 * As URLs são coletadas do próprio carregamento (resource timing), então o
 * teste cobre o que o jogo pede de fato, não uma lista escrito à mão.
 *
 * Uso: node scripts/verifica-assets-instalado.mjs <porta> [caminhoExtra...]
 */
const porta = Number(process.argv[2] || 9340);
const extras = process.argv.slice(3);

const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
const page = lista.find(t => t.type === 'page');
if (!page) { console.error('sem aba'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pend = [];
function cmd(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    pend.push({ id, res, rej });
    setTimeout(() => rej(new Error(`timeout em ${method}`)), 45000);
  });
}
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  const p = pend.find(x => x.id === m.id);
  if (p) { pend.splice(pend.indexOf(p), 1); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
});
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
await cmd('Runtime.enable');
await cmd('Page.enable');

// Substitui por uma página limpa para o resource timing não vir de antes.
await cmd('Page.navigate', { url: 'app://brfut/home.html' });
await cmd('Runtime.evaluate', {
  expression: `(async () => { await new Promise(r => setTimeout(r, 9000)); })()`,
  returnByValue: true, awaitPromise: true,
});

const r = await cmd('Runtime.evaluate', {
  returnByValue: true,
  awaitPromise: true,
  expression: `(async () => {
    const EXTRA = ${JSON.stringify(extras)};
    const ehImagem = u => /\\.(png|webp|jpg|jpeg|svg|gif|avif)(\\?|$)/i.test(u);
    // Imagem inline em base64 não tem arquivo para checar: o src é o próprio
    // conteúdo. Sem este filtro o script tentaria buscar o data URI como
    // endereço e acusaria 404 em algo que está perfeito.
    const ehEndereco = u => u && !u.startsWith('data:') && !u.startsWith('blob:');
    const vistos = new Set(
      performance.getEntriesByType('resource')
        .map(e => e.name)
        .filter(ehImagem)
    );
    for (const img of document.images) {
      const src = img.getAttribute('src');
      if (src && ehEndereco(src)) vistos.add(new URL(src, location.href).pathname);
    }
    EXTRA.filter(ehEndereco).forEach(u => vistos.add(u));

    const resultados = [];
    for (const url of [...vistos].sort()) {
      try {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        resultados.push({ url, status: resp.status, tipo: resp.headers.get('content-type'), bytes: buf.byteLength });
      } catch (e) {
        resultados.push({ url, erro: String(e).slice(0, 80) });
      }
    }
    return resultados;
  })()`,
});

const resultados = r.result.value ?? [];
const quebradas = resultados.filter(x => x.status !== 200 || x.bytes === 0);
const webp = resultados.filter(x => x.url.endsWith('.webp'));

console.log(`imagens servidas: ${resultados.length}`);
console.log(`  webp: ${webp.length}  (todas 200: ${webp.every(x => x.status === 200 && x.bytes > 0)})`);
console.log(`  quebradas: ${quebradas.length}`);
for (const b of quebradas.slice(0, 10)) console.log(`   ${b.status ?? 'erro'} ${b.bytes ?? 0} B  ${b.url}`);

ws.close();
console.log(quebradas.length === 0 ? '\nOK — toda imagem pedida é servida' : '\nFALHOU');
process.exit(quebradas.length === 0 ? 0 : 1);