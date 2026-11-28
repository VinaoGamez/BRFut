import { storage as brfutStorage } from '../../core/storage-backend.js';
import { MODULE_VERSIONS, FEATURES, SITE_MAINTENANCE, SAVE_KEYS, SAVE_VERSION, CAREER_INDEX_KEY, CAREER_SLOT_LIMIT, slotBundleKeys } from '../../core/constants.js';
import '../../../css/new-career-modal.css';
import { initReleaseNotesViewer, renderOptionsUpdateSummary } from '../../ui/release-notes-viewer.js';
import { mountDesktopUpdatePanel } from '../../ui/desktop-update-panel.js';
import { createTesterHubFeature } from '../tester-hub/index.js';
import { mountCrestEditor } from '../../ui/crest-editor.js';
import { getCustomClubByName, retainCustomClubsForCareer, upsertCustomClub } from '../../engine/custom-clubs.js';
import {
  BRAZILIAN_UFS,
  stateCompetitionIdForUf,
} from '../../engine/brazilian-clubs-by-uf.js';
import {
  getAutosaveMode,
  setAutosaveMode,
  listAutosaveOptions,
  mergePreferencesIntoCareer,
} from '../../core/save-preferences.js';
import {
  isCloudStorageActive,
  queueCloudSave,
  getAuthToken,
  flushCloudSyncAsync,
  logoutAccount,
  getSaveSyncStatus,
} from '../../core/storage-api.js';
import { clearCareerData } from '../../core/save-clear.js';
import {
  canCreateSlot,
  createNewSlot,
  getActiveSlotId,
  syncActiveSlotFromCache,
} from '../../core/career-slot-manager.js';
import {
  clearSessionCareerData,
  markFreshCareerBoot,
  markSkipSessionEndOnce,
} from '../../core/save.js';

const GAME_PACE_CONFIG = {
  ultra: { name: 'ULTRA', detail: '8 s por tempo · 16 s de jogo contínuo', seconds: 8, continuous: 16, ms: 250 },
  fast: { name: 'RÁPIDO', detail: '15 s por tempo · 30 s de jogo contínuo', seconds: 15, continuous: 30, ms: 500 },
  standard: { name: 'PADRÃO', detail: '25 s por tempo · 50 s de jogo contínuo', seconds: 25, continuous: 50, ms: 750 },
  detailed: { name: 'DETALHADO', detail: '35 s por tempo · 70 s de jogo contínuo', seconds: 35, continuous: 70, ms: 1150 },
};

const AUTOSAVE_SHORT = {
  round: ['A cada rodada', 'mais seguro (recomendado)'],
  every3: ['A cada 3 jogos', 'menos gravações'],
  manual: ['Só manual', 'você salva quando quiser'],
};

/**
 * Opções do jogo, ritmo da simulação e criação/edição de carreira.
 * @param {object} deps
 * @param {Function} deps.$
 * @param {Function} deps.$$
 * @param {Function} deps.onClick
 * @param {Function} deps.redirectGame
 * @param {Function} deps.cleanCareerText
 * @param {Function} deps.writeJson
 * @param {Function} deps.clearSeasonSave
 * @param {Function} [deps.clearCareerStorage]
 * @param {Function} [deps.markSkipPersistOnce]
 * @param {Function} [deps.prepareForNewCareer]
 * @param {object} deps.SAVE_KEYS
 * @param {boolean} deps.hasCareer
 * @param {Function} deps.getSavedCareer
 * @param {Function} deps.initialBudget
 * @param {number} deps.defaultCareerSeason
 * @param {object} deps.initialEnvironmentRanges
 * @param {Function} [deps.onPaceChanged]
 * @param {Function} [deps.onPreviewSeasonGoal] Preview do medidor da meta (não altera save)
 * @param {Function} [deps.onManualSave]
 * @param {Function} [deps.onPreferencesPersist]
 * @param {object} [deps.matchLiveAudio] Sons da partida ao vivo
 * @param {() => void | Promise<void>} [deps.openAccountLogin]
 */
export function createOptionsFeature(deps) {
  const {
    $,
    $$,
    onClick,
    redirectGame,
    cleanCareerText,
    writeJson,
    clearSeasonSave,
    clearCareerStorage,
    markSkipPersistOnce,
    prepareForNewCareer,
    SAVE_KEYS,
    hasCareer,
    getSavedCareer,
    initialBudget,
    defaultCareerSeason,
    initialEnvironmentRanges,
    onPaceChanged,
    onPreviewSeasonGoal,
    onManualSave,
    onPreferencesPersist,
    matchLiveAudio,
    openAccountLogin,
  } = deps;

  let gamePace = brfutStorage.getItem(SAVE_KEYS.pace) || 'standard';
  if (!GAME_PACE_CONFIG[gamePace]) gamePace = 'standard';
  let autosaveMode = getAutosaveMode();

  const careerExists = () => !!brfutStorage.getItem(SAVE_KEYS.career);

  const ensureNewCareerBackdrop = () => {
    let backdrop = $('#newCareerBackdrop');
    if (backdrop) return backdrop;
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<div id="newCareerBackdrop" class="new-career-backdrop hidden" aria-hidden="true"></div>',
    );
    return $('#newCareerBackdrop');
  };

  const showNewCareerBackdrop = () => {
    ensureNewCareerBackdrop()?.classList.remove('hidden');
    document.body.classList.add('new-career-open');
    document.body.classList.remove('career-locked');
    $('#careerWelcome')?.remove();
    const shell = $('.game-shell');
    if (shell) {
      shell.inert = true;
      shell.setAttribute('aria-hidden', 'true');
    }
  };

  const hideNewCareerBackdrop = () => {
    $('#newCareerBackdrop')?.classList.add('hidden');
    document.body.classList.remove('new-career-open');
    const shell = $('.game-shell');
    if (!shell) return;
    if (careerExists()) {
      shell.inert = false;
      shell.removeAttribute('aria-hidden');
    } else {
      shell.inert = true;
      shell.setAttribute('aria-hidden', 'true');
      document.body.classList.add('career-locked');
    }
  };


  const buildNewGameModalHtml = () => {
    if (FEATURES.stateLeague) {
      const ufOptions = BRAZILIAN_UFS.map(
        uf => `<option value="${uf.code}">${uf.name} (${uf.code})</option>`,
      ).join('');
      return `<div id="newGameModal" class="modal hidden"><div class="modal-card new-game-modal new-career-v2"><button id="closeNewGame" class="close">×</button><header class="new-career-head"><h2>NOVA CARREIRA</h2><p class="new-career-lead">Escolha o estado e a divisão de estreia. Um clube real será sorteado para abrir sua vaga.</p></header><div class="new-career-panels"><section class="new-career-panel new-career-panel-origin" aria-labelledby="newCareerOriginTitle"><h3 id="newCareerOriginTitle" class="new-career-panel-title">Origem</h3><div class="new-career-toolbar"><div class="career-field new-career-uf-field"><label for="careerOriginUf">Estado</label><select id="careerOriginUf" autocomplete="off">${ufOptions}</select></div><div class="career-field new-career-uf-field"><label for="careerTargetDivision">Divisão de estreia</label><select id="careerTargetDivision" autocomplete="off"><option value="A">Série A</option><option value="B">Série B</option><option value="C">Série C</option><option value="D">Série D</option></select></div></div><p id="careerOriginSummary" class="new-career-summary">Prioridade a clubes do seu estado; se não houver, sorteio nacional na divisão escolhida.</p></section><section class="new-career-panel new-career-panel-club" aria-labelledby="newCareerClubTitle"><h3 id="newCareerClubTitle" class="new-career-panel-title">Seu clube</h3><div class="career-fields new-career-fields"><div class="career-field"><label for="careerClubName">Nome do time</label><input id="careerClubName" maxlength="32" autocomplete="off" placeholder="Ex.: Atlético Fênix"></div><div class="career-field"><label for="careerManagerName">Treinador</label><input id="careerManagerName" maxlength="40" autocomplete="off" placeholder="Ex.: Ricardo Almeida"></div><div class="career-field"><label for="careerStadiumName">Estádio</label><input id="careerStadiumName" maxlength="40" autocomplete="off" placeholder="Ex.: Arena Fênix"></div></div><div id="careerCrestEditorMount" class="new-career-crest-mount"></div></section></div><p id="newGameError" class="new-game-error"></p><div class="new-game-buttons"><button id="cancelNewGame" type="button" class="secondary">Cancelar</button><button id="confirmNewGame" type="button">Criar carreira</button></div></div></div>`;
    }
    return `<div id="newGameModal" class="modal hidden"><div class="modal-card new-game-modal new-career-v2"><button id="closeNewGame" class="close">×</button><header class="new-career-head"><h2>NOVA CARREIRA</h2><p class="new-career-lead">Defina seu clube fictício e a divisão de estreia.</p></header><section class="new-career-panel new-career-panel-club"><h3 class="new-career-panel-title">Seu clube</h3><div class="career-fields new-career-fields"><div class="career-field"><label for="careerClubName">Nome do time</label><input id="careerClubName" maxlength="32" autocomplete="off" placeholder="Ex.: Atlético Fênix"></div><div class="career-field"><label for="careerManagerName">Treinador</label><input id="careerManagerName" maxlength="40" autocomplete="off" placeholder="Ex.: Ricardo Almeida"></div><div class="career-field"><label for="careerStadiumName">Estádio</label><input id="careerStadiumName" maxlength="40" autocomplete="off" placeholder="Ex.: Arena Fênix"></div><div class="career-field"><label for="careerDivision">Divisão inicial</label><select id="careerDivision" autocomplete="off"><option value="A">Série A</option><option value="B">Série B</option><option value="C">Série C</option><option value="D">Série D</option></select></div></div><div id="careerCrestEditorMount" class="new-career-crest-mount"></div></section><p id="newGameError" class="new-game-error"></p><div class="new-game-buttons"><button id="cancelNewGame" type="button" class="secondary">Cancelar</button><button id="confirmNewGame" type="button">Criar carreira</button></div></div></div>`;
  };

  const newCareerBlurb = FEATURES.stateLeague
    ? 'Escolha UF e divisão de estreia; a vítima do sorteio é revelada ao iniciar a carreira.'
    : 'Monte seu clube fictício e escolha a divisão de estreia na pirâmide nacional.';



  const injectModals = () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="optionsModal" class="modal hidden"><div class="modal-card options-modal op2" role="dialog" aria-modal="true" aria-labelledby="optionsTitle"><header class="op2-head"><div class="op2-head-copy"><span class="op2-kicker">CONFIGURAÇÕES</span><h2 id="optionsTitle">Opções do jogo</h2></div><button id="closeOptions" class="close" type="button" aria-label="Fechar">×</button></header><div class="op2-main"><nav class="op2-nav" role="tablist"><button type="button" class="op2-tab is-active" data-op-tab="career"><b>CARREIRA</b><small>clube, nova carreira</small></button><button type="button" class="op2-tab" data-op-tab="match"><b>PARTIDA</b><small>ritmo e sons</small></button><button type="button" class="op2-tab" data-op-tab="save"><b>SALVAMENTO</b><small>nuvem e automático</small></button><button type="button" class="op2-tab" data-op-tab="help"><b>AJUDA E CONTA</b><small>novidades, testers, sair</small></button><span id="optionsVersionLine" class="op2-version"></span></nav><div class="op2-panes"><section class="op2-pane is-active" data-op-pane="career"><div id="optionsCareerSummary" class="op2-career"></div><div class="op2-row new-game-action"><div class="op2-row-copy"><strong>Começar nova carreira</strong><small>${newCareerBlurb} A carreira atual continua salva no seu espaço de carreiras.</small></div><button id="openNewGame" type="button" class="op2-btn is-sec">NOVO JOGO</button></div><div id="optionsUniverse" class="op2-universe"></div></section><section class="op2-pane" data-op-pane="match"><header class="op2-sec"><h3>Ritmo da partida</h3></header><p class="op2-lead">Quanto dura cada tempo na simulação. Pausas técnicas e decisões continuam com você.</p><div id="paceChoices" class="option-choices op2-paces">${Object.entries(GAME_PACE_CONFIG).map(([key, pace]) => `<button type="button" class="pace-choice op2-pace" data-pace="${key}"><span class="op2-pace-name">${pace.name}</span><strong>${pace.seconds} s<small> por tempo</small></strong><span class="op2-pace-detail">${pace.continuous} s de jogo contínuo</span><em class="op2-selected">SELECIONADO</em></button>`).join('')}</div><header class="op2-sec"><h3>Sons ao vivo</h3></header><div class="op2-audio"><div id="liveAudioOptions" class="live-audio-options"></div><span id="liveAudioVolumeLabel" class="op2-volume-label"></span><button id="liveAudioTest" type="button" class="op2-btn is-sec">TESTAR</button></div></section><section class="op2-pane" data-op-pane="save"><div id="optionsSaveStatus" class="op2-status"><i class="op2-dot"></i><div class="op2-row-copy"><strong id="optionsSaveStatusTitle">Verificando…</strong><small id="saveSyncStatus">Verificando estado do save…</small></div><button id="manualSaveBtn" type="button" class="op2-btn is-primary">SALVAR AGORA</button></div><header class="op2-sec"><h3>Salvar automaticamente</h3></header><div id="autosaveChoices" class="op2-choices">${listAutosaveOptions().map(opt => `<button type="button" class="op2-choice" data-autosave="${opt.value}"><strong>${AUTOSAVE_SHORT[opt.value]?.[0] || opt.label}</strong><small>${AUTOSAVE_SHORT[opt.value]?.[1] || ''}</small></button>`).join('')}</div><header class="op2-sec"><h3>Onde fica salvo</h3></header><div class="op2-where"><div class="op2-tile"><span>NESTE APARELHO</span><strong class="t-good">Sempre</strong><small>gravado no navegador</small></div><div class="op2-tile"><span>NA NUVEM</span><strong id="optionsCloudState">—</strong><small id="optionsCloudHint">continua em outro aparelho</small></div></div><p class="op2-note">"SALVO LOCAL" no topo significa: gravado neste aparelho, ainda não confirmado na nuvem.</p></section><section class="op2-pane" data-op-pane="help"><header class="op2-sec"><h3>Novidades</h3></header><div class="op2-row option-section op2-updates"><div class="op2-row-copy"><strong>Última atualização</strong><small id="optionsLatestUpdate">—</small></div><button id="openReleaseNotes" type="button" class="op2-btn is-sec">VER NOVIDADES</button></div><header class="op2-sec is-gold"><h3>Testers</h3></header><div class="op2-testers"><button id="openTesterGuide" type="button" class="op2-card"><strong>Guia do tester</strong><small>Como testar esta versão</small><em>Abrir guia ›</em></button><button id="openTesterFeedback" type="button" class="op2-card"><strong>Enviar feedback</strong><small>Relatório pelo GitHub ou texto copiado</small><em>Enviar ›</em></button><button id="previewSeasonGoalGauge" type="button" class="op2-card" title="Abre a retrospectiva com dados fictícios — não altera a carreira"><strong>Preview da meta</strong><small>Ver o medidor de meta da temporada</small><em>Abrir ›</em></button></div><header class="op2-sec is-red"><h3>Conta</h3></header><div class="op2-row"><div class="op2-row-copy"><strong id="optionsAccountLine">Conta</strong><small>Sua carreira fica salva na nuvem ao sair</small></div><button id="optionsLogout" type="button" class="op2-btn is-danger">SAIR DA CONTA</button></div></section></div></div><footer class="op2-foot"><span id="optionsFootNote">As alterações são salvas na hora</span><button id="closeOptionsFoot" type="button" class="op2-btn is-ghost">FECHAR</button></footer></div></div>${buildNewGameModalHtml()}`,
    );
    const updatesSection = $('#optionsLatestUpdate')?.closest('.option-section');
    if (updatesSection) {
      const updates = mountDesktopUpdatePanel(document, window.brfutDesktop?.updates, { container: updatesSection });
      if (updates) window.addEventListener('pagehide', () => updates.dispose(), { once: true });
    }
  };

  const injectCareerWelcome = () => {
    if (hasCareer || $('#careerWelcome')) return;
    document.body.classList.add('career-locked');
    const shell = $('.game-shell');
    if (shell) {
      shell.inert = true;
      shell.setAttribute('aria-hidden', 'true');
    }
    document.body.insertAdjacentHTML(
      'beforeend',
      '<section id="careerWelcome" class="career-welcome"><div class="career-welcome-content"><div class="career-welcome-brand"><img class="career-welcome-logo" src="./brand/lockup-lg.webp" alt="BR Fut" width="379" height="72"></div><div class="career-welcome-actions"><button id="welcomeLogin" type="button">ENTRAR</button><button id="welcomeNewGame" type="button" class="primary hidden">NOVO JOGO</button></div><p id="welcomeHint" class="career-welcome-hint hidden"></p></div></section>',
    );
  };

  const syncWelcomeAuth = ({ loggedIn, hasBackend }) => {
    const loginBtn = $('#welcomeLogin');
    const newBtn = $('#welcomeNewGame');
    const hint = $('#welcomeHint');
    if (!loginBtn || !newBtn) return;

    if (SITE_MAINTENANCE.enabled) {
      loginBtn.classList.add('hidden');
      newBtn.classList.add('hidden');
      hint?.classList.remove('hidden');
      hint?.classList.add('is-maintenance');
      if (hint) hint.textContent = SITE_MAINTENANCE.message;
      return;
    }

    hint?.classList.remove('is-maintenance');

    if (loggedIn && hasBackend) {
      loginBtn.classList.add('hidden');
      newBtn.classList.remove('hidden');
      hint?.classList.remove('hidden');
      if (hint) hint.textContent = 'Conta conectada — crie sua carreira.';
      return;
    }

    if (loggedIn && !hasBackend) {
      loginBtn.classList.add('hidden');
      newBtn.classList.remove('hidden');
      hint?.classList.add('hidden');
      return;
    }

    loginBtn.classList.remove('hidden');
    newBtn.classList.add('hidden');
    hint?.classList.add('hidden');
  };

  injectModals();
  injectCareerWelcome();
  if (SITE_MAINTENANCE.enabled) {
    syncWelcomeAuth({ loggedIn: false, hasBackend: false });
  }

  const careerCrestMount = $('#careerCrestEditorMount');
  const careerCrestEditor = careerCrestMount
    ? mountCrestEditor(careerCrestMount, {
        getClubName: () => cleanCareerText($('#careerClubName')?.value || '', ''),
      })
    : null;

  const paintLiveAudioOptions = root => {
    if (!root || !matchLiveAudio?.renderOptions) return;
    void Promise.resolve(matchLiveAudio.renderOptions(root));
  };
  $('#careerClubName')?.addEventListener('input', () => careerCrestEditor?.refreshPreview());
  paintLiveAudioOptions($('#liveAudioOptions'));

  const testerHub = createTesterHubFeature({
    onOpenGuide: () => $('#optionsModal')?.classList.add('hidden'),
    onOpenFeedback: () => $('#optionsModal')?.classList.add('hidden'),
  });

  const persistPreferences = patch => {
    const career = getSavedCareer?.();
    if (career) mergePreferencesIntoCareer(career, patch);
    onPreferencesPersist?.(patch);
  };

  const minutesAgo = ts => {
    const t = Number(ts) || 0;
    if (!t) return null;
    const min = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (min < 1) return 'agora há pouco';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia${Math.round(h / 24) === 1 ? '' : 's'}`;
  };

  const selectOptionsTab = tab => {
    $$('#optionsModal [data-op-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.opTab === tab));
    $$('#optionsModal [data-op-pane]').forEach(pane => pane.classList.toggle('is-active', pane.dataset.opPane === tab));
    const foot = $('#optionsFootNote');
    if (foot) foot.textContent = tab === 'help' ? 'Sair pede confirmação' : 'As alterações são salvas na hora';
  };

  const syncVolumeLabel = () => {
    const slider = $('#liveAudioVolume');
    const label = $('#liveAudioVolumeLabel');
    if (label) label.textContent = slider ? `${slider.value}%` : '';
  };

  const renderOptions = () => {
    autosaveMode = getAutosaveMode();
    $$('#autosaveChoices [data-autosave]').forEach(btn => btn.classList.toggle('is-on', btn.dataset.autosave === autosaveMode));
    $$('#paceChoices button').forEach(button =>
      button.classList.toggle('selected', button.dataset.pace === gamePace),
    );
    const syncStatus = getSaveSyncStatus();
    const pending = syncStatus.pendingKeys.length;
    const when = minutesAgo(syncStatus.lastSuccessAt || syncStatus.localRevision);
    const states = {
      connected: ['good', pending ? 'Salvo neste aparelho' : 'Salvo na nuvem', 'Conectada'],
      syncing: ['mid', 'Enviando para a nuvem…', 'Enviando'],
      reconnecting: ['mid', 'Salvo neste aparelho', 'Reconectando'],
      rate_limited: ['mid', 'Salvo neste aparelho', 'Aguardando'],
      offline: ['mid', 'Salvo neste aparelho', 'Indisponível'],
      expired: ['bad', 'Sessão expirada', 'Entre de novo'],
      signed_out: ['mid', 'Salvo só neste aparelho', 'Sem conta'],
    };
    const [tone, title, cloud] = states[syncStatus.authState] || states.offline;
    const status = $('#optionsSaveStatus');
    if (status) status.dataset.tone = tone;
    const titleEl = $('#optionsSaveStatusTitle');
    if (titleEl) titleEl.textContent = title;
    const syncStatusEl = $('#saveSyncStatus');
    if (syncStatusEl) {
      const parts = [];
      if (when) parts.push(`Última gravação: ${when}`);
      parts.push(pending ? `${pending} alteraç${pending === 1 ? 'ão' : 'ões'} aguardando envio` : 'tudo enviado');
      if (syncStatus.authState === 'expired') parts.push('entre na conta para voltar a salvar na nuvem');
      syncStatusEl.textContent = parts.join(' · ');
    }
    const cloudEl = $('#optionsCloudState');
    if (cloudEl) {
      cloudEl.textContent = cloud;
      cloudEl.className = tone === 'good' ? 't-good' : tone === 'bad' ? 't-bad' : 't-mid';
    }
    const accountLine = $('#optionsAccountLine');
    if (accountLine) accountLine.textContent = syncStatus.authState === 'signed_out' ? 'Sem conta conectada' : 'Conta conectada';
    const logout = $('#optionsLogout');
    if (logout && logout.dataset.armed !== '1') logout.textContent = 'SAIR DA CONTA';
    paintLiveAudioOptions($('#liveAudioOptions'));
    syncVolumeLabel();
    renderOptionsUpdateSummary();
    const latest = $('#optionsLatestUpdate')?.textContent || '';
    const versionLine = $('#optionsVersionLine');
    if (versionLine) versionLine.textContent = latest && latest !== '—' ? `Versão ${latest.split('·').pop().trim()}` : '';
  };

  initReleaseNotesViewer({ $, onClick });
  onClick('#openOptions', () => {
    selectOptionsTab('career');
    renderOptions();
    $('#optionsModal').classList.remove('hidden');
  });
  onClick('#closeOptions', () => $('#optionsModal').classList.add('hidden'));
  onClick('#closeOptionsFoot', () => $('#optionsModal').classList.add('hidden'));
  onClick('#optionsModal', event => {
    const tab = event.target.closest('[data-op-tab]');
    if (tab) {
      selectOptionsTab(tab.dataset.opTab);
      return;
    }
    const auto = event.target.closest('[data-autosave]');
    if (auto) {
      autosaveMode = setAutosaveMode(auto.dataset.autosave);
      persistPreferences({ autosave: autosaveMode, gamesSinceAutosave: 0 });
      renderOptions();
    }
  });
  document.addEventListener('input', event => {
    if (event.target?.id === 'liveAudioVolume') syncVolumeLabel();
  });
  onClick('#liveAudioTest', () => {
    try { matchLiveAudio?.playKickoff?.(); } catch { /* sem áudio */ }
  });
  onClick('#openTesterGuide', () => testerHub.openGuide());
  onClick('#openTesterFeedback', () => testerHub.openFeedback());
  onClick('#previewSeasonGoalGauge', () => {
    $('#optionsModal')?.classList.add('hidden');
    onPreviewSeasonGoal?.();
  });

  let selectedOriginUf = 'SP';
  let selectedTargetDivision = 'A';

  const updateCareerOriginSummary = () => {
    const summary = $('#careerOriginSummary');
    if (!summary) return;
    const divisionLabels = { A: 'Série A', B: 'Série B', C: 'Série C', D: 'Série D' };
    const ufName = BRAZILIAN_UFS.find(item => item.code === selectedOriginUf)?.name || selectedOriginUf;
    summary.textContent = `Estreia na ${divisionLabels[selectedTargetDivision] || 'Série A'} · origem ${ufName} (${selectedOriginUf}). O clube sorteado será revelado após criar a carreira.`;
    summary.classList.remove('is-empty');
  };

  const openCareerCreator = () => {
    showNewCareerBackdrop();
    $('#careerClubName').value = '';
    $('#careerManagerName').value = '';
    $('#careerStadiumName').value = '';
    careerCrestEditor?.setCrest({});
    careerCrestEditor?.refreshPreview();
    $('#newGameError').textContent = '';
    if (FEATURES.stateLeague) {
      selectedOriginUf = 'SP';
      selectedTargetDivision = 'A';
      $('#careerOriginUf').value = selectedOriginUf;
      const divisionEl = $('#careerTargetDivision');
      if (divisionEl) divisionEl.value = selectedTargetDivision;
      updateCareerOriginSummary();
    } else {
      const divisionEl = $('#careerDivision');
      if (divisionEl) divisionEl.value = 'A';
    }
    $('#optionsModal').classList.add('hidden');
    $('#newGameModal').classList.remove('hidden');
    setTimeout(() => $('#careerClubName')?.focus(), 0);
  };

  const closeCareerCreator = () => {
    $('#newGameModal').classList.add('hidden');
    if (!careerExists() && new URLSearchParams(location.search).has('novo')) {
      markSkipSessionEndOnce();
      location.replace('home.html');
      return;
    }
    hideNewCareerBackdrop();
  };

  onClick('#openNewGame', openCareerCreator);
  onClick('#welcomeLogin', () => {
    void openAccountLogin?.();
  });
  onClick('#welcomeNewGame', openCareerCreator);

  if (new URLSearchParams(location.search).has('novo')) {
    showNewCareerBackdrop();
    setTimeout(openCareerCreator, 0);
  }

  onClick('#closeNewGame', closeCareerCreator);
  onClick('#cancelNewGame', closeCareerCreator);
  if (FEATURES.stateLeague) {
    $('#careerOriginUf')?.addEventListener('change', event => {
      selectedOriginUf = event.target.value || 'SP';
      updateCareerOriginSummary();
    });
    $('#careerTargetDivision')?.addEventListener('change', event => {
      selectedTargetDivision = event.target.value || 'A';
      if (!['A', 'B', 'C', 'D'].includes(selectedTargetDivision)) selectedTargetDivision = 'A';
      updateCareerOriginSummary();
    });
  }

  onClick('#confirmNewGame', async () => {
    const clubName = cleanCareerText($('#careerClubName').value, '');
    const managerName = cleanCareerText($('#careerManagerName').value, '');
    const stadiumName = cleanCareerText($('#careerStadiumName').value, '');
    const error = $('#newGameError');
    if (clubName.length < 3) {
      error.textContent = 'Informe um nome de time com pelo menos 3 caracteres.';
      $('#careerClubName').focus();
      return;
    }
    if (managerName.length < 3) {
      error.textContent = 'Informe o nome do treinador com pelo menos 3 caracteres.';
      $('#careerManagerName').focus();
      return;
    }
    if (stadiumName.length < 3) {
      error.textContent = 'Informe o nome do estádio com pelo menos 3 caracteres.';
      $('#careerStadiumName').focus();
      return;
    }

    let selectedCareerDivision = 'A';
    /** @type {Record<string, unknown>} */
    const careerPayloadExtra = {};

    if (FEATURES.stateLeague) {
      if (!selectedOriginUf) {
        error.textContent = 'Escolha o estado de origem.';
        return;
      }
      if (!['A', 'B', 'C', 'D'].includes(selectedTargetDivision)) {
        error.textContent = 'Escolha a divisão de estreia.';
        return;
      }
      selectedCareerDivision = selectedTargetDivision;
      Object.assign(careerPayloadExtra, {
        userUf: selectedOriginUf,
        targetDivision: selectedTargetDivision,
        replacementMode: 'cascade',
        stateCompetitionId: stateCompetitionIdForUf(selectedOriginUf),
        regionalBaseClubs: [],
        version: SAVE_VERSION.career,
      });
    } else {
      selectedCareerDivision = $('#careerDivision')?.value || 'A';
      if (!['A', 'B', 'C', 'D'].includes(selectedCareerDivision)) selectedCareerDivision = 'A';
      Object.assign(careerPayloadExtra, { version: SAVE_VERSION.career });
    }

    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const status = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const environmentRange = initialEnvironmentRanges[selectedCareerDivision];
    const clubStatus = {
      environment: status(...environmentRange),
      support: status(55, 88),
      board: status(55, 88),
      finances: status(55, 88),
      budget: initialBudget(selectedCareerDivision),
    };
    const crest = careerCrestEditor?.getCrest() || null;
    // Impede a sessão atual de regravar o save antigo antes do redirect.
    const slotFromUrl = new URLSearchParams(location.search).get('slot');
    let activeSlot = slotFromUrl || getActiveSlotId();
    if (!activeSlot) {
      if (!canCreateSlot()) {
        error.textContent = `Limite de ${CAREER_SLOT_LIMIT} saves por conta.`;
        return;
      }
      activeSlot = createNewSlot();
      if (!activeSlot) {
        error.textContent = 'Não foi possível criar o espaço desta carreira. Verifique o armazenamento e tente novamente.';
        return;
      }
    }
    prepareForNewCareer?.();
    markSkipPersistOnce?.();
    await clearCareerData('career', { cloud: 'await', clearTraining: true });
    retainCustomClubsForCareer(clubName);
    const careerPayload = {
      seed,
      clubName,
      managerName,
      stadiumName,
      foundingClubName: clubName,
      careerClubHistory: [clubName],
      pendingSponsorChoice: true,
      division: selectedCareerDivision,
      clubStatus,
      season: defaultCareerSeason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      freshWorld: true,
      crest,
      preferences: {
        autosave: getAutosaveMode(),
        pace: gamePace,
        gamesSinceAutosave: 0,
      },
      ...careerPayloadExtra,
    };
    if (crest) {
      const customClubPayload = {
        name: clubName,
        country: 'BRA',
        uf: FEATURES.stateLeague ? selectedOriginUf : 'SP',
        division: selectedCareerDivision,
        crest,
      };
      const existingCustom = getCustomClubByName(clubName);
      if (existingCustom?.id) customClubPayload.id = existingCustom.id;
      upsertCustomClub(customClubPayload);
    }
    const saved = writeJson(SAVE_KEYS.career, careerPayload);
    if (!saved) {
      error.textContent =
        'Não foi possível salvar a nova carreira (memória do navegador cheia). Limpe dados do site e tente novamente.';
      return;
    }
    markFreshCareerBoot();
    syncActiveSlotFromCache();
    {
      const slotId = getActiveSlotId();
      const cloudKeys = [SAVE_KEYS.career, CAREER_INDEX_KEY];
      if (slotId) cloudKeys.push(...Object.values(slotBundleKeys(slotId)));
      try {
        // Sempre tenta (ensureCloudReady reativa sessão se o token existir).
        await flushCloudSyncAsync({ forceLocalKeys: cloudKeys });
      } catch {
        if (isCloudStorageActive()) queueCloudSave(SAVE_KEYS.career, careerPayload);
      }
    }
    $('#newGameModal').classList.add('hidden');
    $('#optionsModal').classList.add('hidden');
    hideNewCareerBackdrop();
    redirectGame();
  });

  onClick('#paceChoices', event => {
    const button = event.target.closest('button');
    if (!button) return;
    gamePace = button.dataset.pace;
    brfutStorage.setItem(SAVE_KEYS.pace, gamePace);
    persistPreferences({ pace: gamePace });
    renderOptions();
    onPaceChanged?.();
  });


  onClick('#manualSaveBtn', async () => {
    const btn = $('#manualSaveBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'SALVANDO…';
    }
    let result;
    try { result = await onManualSave?.(); }
    catch { result = { localOk: false, saveError: true }; }
    renderOptions();
    const localOk = result?.localOk ?? result?.seasonLocalOk ?? (result === true);
    const cloudOk = result?.cloud === true;
    const cloudHint = (() => {
      if (result?.saveError) return 'FALHA AO SALVAR';
      if (!localOk) return 'MEMÓRIA CHEIA';
      if (cloudOk && result?.careerOk && result?.seasonOk) return 'SALVO!';
      if (result?.cloudReason === 'cloud_inactive') {
        return 'SALVO LOCAL';
      }
      if (result?.cloudReason === 'auth_rejected') return 'LOCAL (SESSÃO)';
      if (result?.cloudReason === 'cloud_unreachable') return 'LOCAL (REDE)';
      if (result?.cloudReason === 'empty_batch') return 'LOCAL (VAZIO)';
      const err = result?.cloudErrors?.[0];
      if (err?.status === 401) return 'LOCAL (SESSÃO)';
      if (err?.status === 413) return 'LOCAL (GRANDE)';
      if (err?.status === 429) return 'LOCAL (LIMITE)';
      if (err?.status === 0 || err?.code === 'network_failed') return 'LOCAL (REDE)';
      if (localOk && (result?.seasonOk || result?.careerOk)) return 'LOCAL + PARCIAL';
      if (localOk) return 'SALVO LOCAL';
      return 'SEM SAVE';
    })();
    if (btn) {
      const prev = 'SALVAR AGORA';
      btn.textContent = cloudHint;
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.disabled = false;
      }, 1800);
    }
  });

  onClick('#optionsLogout', async () => {
    const btn = $('#optionsLogout');
    if (btn && btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'CONFIRMAR SAÍDA';
      btn.classList.add('is-armed');
      window.setTimeout(() => {
        if (!btn.isConnected) return;
        btn.dataset.armed = '';
        btn.textContent = 'SAIR DA CONTA';
        btn.classList.remove('is-armed');
      }, 4000);
      return;
    }
    $('#optionsModal')?.classList.add('hidden');
    try {
      // Save final é best-effort: rede indisponível não pode impedir o logout.
      await Promise.race([
        Promise.resolve(onManualSave?.()),
        new Promise(resolve => window.setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* ignore */
    }
    try {
      await logoutAccount();
    } finally {
      clearSessionCareerData();
      // Volta à home deslogado mesmo se a API estiver fora do ar.
      const home = new URL('home.html', location.href);
      location.replace(`${home.pathname}${home.search}`);
    }
  });

  return {
    moduleVersion: MODULE_VERSIONS.options,
    getPace: () => gamePace,
    getPaceMs: () => (GAME_PACE_CONFIG[gamePace] || GAME_PACE_CONFIG.standard).ms,
    getPaceConfig: () => GAME_PACE_CONFIG,
    getAutosaveMode: () => getAutosaveMode(),
    renderOptions,
    openCareerCreator,
    syncWelcomeAuth,
  };
}
