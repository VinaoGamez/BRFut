/** Redireciona brfut.com.br de HTTP → HTTPS (API exige origem segura). */
(() => {
  if (location.protocol !== 'http:') return;
  const host = location.hostname.toLowerCase();
  if (host !== 'brfut.com.br' && host !== 'www.brfut.com.br') return;
  location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`);
})();
