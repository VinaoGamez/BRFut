/** Optional desktop UI. All release metadata is rendered as text, never HTML. */
export function mountDesktopUpdatePanel(document, api) {
  if (!api?.getStatus || document.getElementById('desktopUpdates')) return null;
  const make = (tag, id, text, parent) => {
    const element = document.createElement(tag);
    if (id) element.id = id;
    if (text) element.textContent = text;
    parent?.append(element);
    return element;
  };
  const root = make('section', 'desktopUpdates', '', document.body);
  root.className = 'desktop-updates';
  const toggle = make('button', 'desktopUpdatesToggle', 'Atualizações', root);
  toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'desktopUpdatesPanel');
  const panel = make('aside', 'desktopUpdatesPanel', '', root);
  panel.hidden = true; panel.setAttribute('aria-label', 'Atualizações do BR Fut');
  const title = make('strong', 'desktopUpdatesVersion', 'BR Fut', panel);
  const message = make('p', 'desktopUpdatesMessage', 'Consulta opcional. Você pode jogar offline.', panel);
  message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const actions = make('div', '', '', panel); actions.className = 'desktop-updates-actions';
  const button = (id, text) => { const el = make('button', id, text, actions); el.type = 'button'; return el; };
  const check = button('desktopUpdatesCheck', 'Verificar agora');
  const notes = button('desktopUpdatesNotes', 'Ver novidades');
  const download = button('desktopUpdatesDownload', 'Abrir download');
  const history = button('desktopUpdatesHistory', 'Histórico no GitHub');
  const close = button('desktopUpdatesClose', 'Mais tarde');
  const label = make('label', '', '', panel);
  const auto = make('input', 'desktopUpdatesAutoCheck', '', label);
  auto.type = 'checkbox'; make('span', '', 'Consultar ao abrir (usa internet)', label);
  const details = make('details', '', '', panel);
  const summary = make('summary', '', 'Novidades da versão instalada', details);
  const body = make('pre', 'desktopUpdatesBody', '', details);
  make('small', '', 'Sem instalação automática. Salve sua carreira e feche o jogo antes de executar um novo instalador.', panel);
  let current = null, disposed = false;
  const render = status => {
    if (disposed || !status) return;
    current = status;
    const available = status.state === 'available' && status.release;
    title.textContent = `BR Fut ${status.currentVersion}`;
    toggle.textContent = available ? `Nova versão ${status.release.version} disponível` : `BR Fut ${status.currentVersion} · Atualizações`;
    toggle.classList.toggle('has-update', !!available);
    message.textContent = {
      idle: 'Consulta opcional. Você pode jogar offline.',
      checking: 'Consultando lançamentos no GitHub…',
      available: `BR Fut ${status.release?.version} disponível. A atualização é opcional.`,
      'up-to-date': 'Você está na versão mais recente disponível neste canal.',
      'no-release': 'Ainda não há instalador publicado neste canal.',
      unavailable: status.error === 'rate-limited'
        ? 'O GitHub limitou as consultas. Tente novamente mais tarde; o jogo continua disponível.'
        : 'Não foi possível consultar as atualizações. Continue jogando offline e tente mais tarde.',
    }[status.state] || 'Você pode continuar jogando offline.';
    check.disabled = status.state === 'checking';
    auto.checked = !!status.autoCheck;
    notes.hidden = download.hidden = !available;
    summary.textContent = available ? `Novidades da versão ${status.release.version}` : 'Novidades da versão instalada';
    body.textContent = available ? status.release.notes || 'Veja os detalhes no GitHub.' : status.currentNotes || 'Histórico de lançamentos disponível no GitHub.';
  };
  const run = async action => {
    try { const result = await action(); if (result?.state) render(result); }
    catch {
      if (disposed) return;
      message.textContent = 'Não foi possível concluir a operação. Você pode continuar jogando.';
      if (current) auto.checked = !!current.autoCheck;
    }
  };
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  close.addEventListener('click', () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
  check.addEventListener('click', () => { void run(() => api.check()); });
  notes.addEventListener('click', () => { void run(() => api.openNotes()); });
  download.addEventListener('click', () => { void run(() => api.openInstaller()); });
  history.addEventListener('click', () => { void run(() => api.openHistory()); });
  auto.addEventListener('change', () => { void run(() => api.setAutoCheck(auto.checked)); });
  const unsubscribe = api.onStatus?.(render);
  void run(() => api.getStatus());
  return { element: root, render, dispose: () => { disposed = true; unsubscribe?.(); } };
}
