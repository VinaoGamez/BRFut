const porta = Number(process.argv[2] || 9342);
const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
const page = lista.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0; const pend = []; const excecoes = [];
function cmd(m, p = {}) {
  const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p }));
  return new Promise((res, rej) => { pend.push({ id, res, rej }); setTimeout(() => rej(new Error(`timeout ${m}`)), 60000); });
}
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') excecoes.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 140));
  const p = pend.find(x => x.id === m.id);
  if (p) { pend.splice(pend.indexOf(p), 1); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
await cmd('Runtime.enable'); await cmd('Page.enable');

const avaliar = async (e) => {
  const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

console.log('tela inicial');
await cmd('Page.navigate', { url: 'app://brfut/home.html' });
await avaliar('(async () => { await new Promise(r => setTimeout(r, 9000)); })()');
let r = await avaliar(`(() => {
  const im = [...document.images];
  return { nos: document.body.querySelectorAll('*').length,
           quebradas: im.filter(i => i.complete && i.naturalWidth === 0 && !/^data:/.test(i.src)).map(i => i.getAttribute('src')),
           rodape: (document.querySelector('.home-footer')?.innerText || '').replace(/\\s+/g,' ').trim() };
})()`);
console.log(`  ${r.nos} nos | quebradas: ${r.quebradas.length} | rodape: ${r.rodape}`);

console.log('jogo');
await cmd('Page.navigate', { url: 'app://brfut/index.html?novo=1' });
await avaliar('(async () => { await new Promise(r => setTimeout(r, 28000)); })()');
r = await avaliar(`(() => {
  const im = [...document.images];
  return { nos: document.body.querySelectorAll('*').length,
           modal: !!document.getElementById('confirmNewGame'),
           splash: (() => { const s = document.getElementById('bootSplash'); return s ? getComputedStyle(s).display !== 'none' : null; })(),
           quebradas: im.filter(i => i.complete && i.naturalWidth === 0 && !/^data:/.test(i.src)).map(i => i.getAttribute('src')),
           webp: im.filter(i => /\\.webp(\\?|$)/.test(i.getAttribute('src') || '')).length };
})()`);
console.log(`  ${r.nos} nos | modal: ${r.modal} | splash travado: ${r.splash === true}`);
console.log(`  imagens quebradas: ${r.quebradas.length} | webp no DOM: ${r.webp}`);
if (r.quebradas.length) console.log(`  ${r.quebradas.slice(0, 5).join(' | ')}`);
console.log(`  excecoes no console: ${excecoes.length}`);
if (excecoes.length) console.log(excecoes.slice(0, 3).map(e => `   ${e}`).join('\n'));

const falha = r.quebradas.length > 0 || r.splash === true || !r.modal || excecoes.length > 0;
console.log('\n' + (falha ? 'FALHOU' : 'OK — jogo sobe limpo'));
ws.close(); process.exit(falha ? 1 : 0);