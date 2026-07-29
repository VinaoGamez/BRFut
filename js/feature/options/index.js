import { MODULE_VERSIONS, FEATURES, SITE_MAINTENANCE, SAVE_KEYS, CAREER_INDEX_KEY, CAREER_SLOT_LIMIT, slotBundleKeys } from '../../core/constants.js';
import '../../../css/new-career-modal.css';
import { initReleaseNotesViewer, renderOptionsUpdateSummary } from '../../ui/release-notes-viewer.js';
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
import { endBrowserSession, isCloudStorageActive, queueCloudSave, getAuthToken, flushCloudSyncAsync } from '../../core/storage-api.js';
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
  ultra: { name: 'ULTRA', detail: '8 s por tempo · 16 s de jogo contínuo', ms: 250 },
  fast: { name: 'RÁPIDO', detail: '15 s por tempo · 30 s de jogo contínuo', ms: 500 },
  standard: { name: 'PADRÃO', detail: '25 s por tempo · 50 s de jogo contínuo', ms: 750 },
  detailed: { name: 'DETALHADO', detail: '35 s por tempo · 70 s de jogo contínuo', ms: 1150 },
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

  let gamePace = localStorage.getItem(SAVE_KEYS.pace) || 'standard';
  if (!GAME_PACE_CONFIG[gamePace]) gamePace = 'standard';
  let autosaveMode = getAutosaveMode();

  const careerExists = () => !!localStorage.getItem(SAVE_KEYS.career);

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

  const autosaveOptionsHtml = listAutosaveOptions()
    .map(
      opt =>
        `<option value="${opt.value}"${opt.value === autosaveMode ? ' selected' : ''}>${opt.label}</option>`,
    )
    .join('');

  const injectModals = () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="optionsModal" class="modal hidden"><div class="modal-card options-modal"><button id="closeOptions" class="close">×</button><label>CONFIGURAÇÕES</label><h2>Opções do Jogo</h2><section class="option-section"><label>NOVA CARREIRA</label><div class="new-game-action"><div><strong>Criar clube e iniciar carreira</strong><small>${newCareerBlurb}</small></div><button id="openNewGame" type="button">NOVO JOGO</button></div></section><section class="option-section"><label>SALVAMENTO</label><p>Escolha quando o jogo grava automaticamente. O ritmo de jogo também é salvo junto com a carreira.</p><p class="save-prefs-note"><small>Sempre grava neste navegador. Com conta conectada, espelha na nuvem (5081 / BR Fut). “SALVO LOCAL” = só navegador; nuvem não confirmou.</small></p><div class="save-prefs-row"><select id="autosaveMode" autocomplete="off">${autosaveOptionsHtml}</select><button id="manualSaveBtn" type="button">SALVAR</button></div></section><section class="option-section"><label>RITMO DE JOGO</label><p>Define a duração da simulação contínua. Pausas técnicas e decisões do treinador continuam sob seu controle.</p><div id="paceChoices" class="option-choices">${Object.entries(GAME_PACE_CONFIG).map(([key, pace]) => `<button class="pace-choice" data-pace="${key}"><b>${pace.name}</b><small>${pace.detail}</small></button>`).join('')}</div></section><section class="option-section"><label>SONS AO VIVO</label><p>Apito, narração e reação da torcida durante a simulação de partida.</p><div id="liveAudioOptions" class="live-audio-options"></div></section><section class="option-section"><label>INFORMAÇÕES DE ATUALIZAÇÕES</label><div class="updates-info-row"><div class="updates-info-summary"><strong>Última Atualização</strong><span id="optionsLatestUpdate">—</span></div><button id="openReleaseNotes" type="button">CONSULTAR</button></div></section><section class="option-section"><label>CONTA</label><p>Encerra a sessão e volta à tela inicial. Seus dados ficam salvos na nuvem.</p><div class="options-logout-row"><button id="optionsLogout" type="button">SAIR</button></div></section><section class="option-section"><label>TESTERS</label><div class="new-game-action"><div><strong>Guia e feedback</strong><small>Como testar a build e enviar relatório estruturado (GitHub ou copiar texto).</small></div><div class="option-choices" style="flex:none;display:flex;gap:8px;flex-wrap:wrap"><button id="openTesterGuide" type="button">GUIA</button><button id="openTesterFeedback" type="button">FEEDBACK</button><button id="previewSeasonGoalGauge" type="button" title="Abre o balanço com dados fictícios — não altera a carreira">PREVIEW META</button></div></div></section></div></div>${buildNewGameModalHtml()}`,
    );
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
      '<section id="careerWelcome" class="career-welcome"><div class="career-welcome-content"><div class="career-welcome-brand"><img class="career-welcome-logo" src="./brand/lockup-lg.png" alt="BR Fut" width="480" height="72"></div><div class="career-welcome-actions"><button id="welcomeLogin" type="button">ENTRAR</button><button id="welcomeNewGame" type="button" class="primary hidden">NOVO JOGO</button></div><p id="welcomeHint" class="career-welcome-hint hidden"></p></div></section>',
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

  const renderOptions = () => {
    autosaveMode = getAutosaveMode();
    const autosaveEl = $('#autosaveMode');
    if (autosaveEl) autosaveEl.value = autosaveMode;
    $$('#paceChoices button').forEach(button =>
      button.classList.toggle('selected', button.dataset.pace === gamePace),
    );
    paintLiveAudioOptions($('#liveAudioOptions'));
    renderOptionsUpdateSummary();
  };

  initReleaseNotesViewer({ $, onClick });
  onClick('#openOptions', () => {
    renderOptions();
    $('#optionsModal').classList.remove('hidden');
  });
  onClick('#closeOptions', () => $('#optionsModal').classList.add('hidden'));
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
        version: 6,
      });
    } else {
      selectedCareerDivision = $('#careerDivision')?.value || 'A';
      if (!['A', 'B', 'C', 'D'].includes(selectedCareerDivision)) selectedCareerDivision = 'A';
      Object.assign(careerPayloadExtra, { version: 4 });
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
    localStorage.setItem(SAVE_KEYS.pace, gamePace);
    persistPreferences({ pace: gamePace });
    renderOptions();
    onPaceChanged?.();
  });

  $('#autosaveMode')?.addEventListener('change', event => {
    autosaveMode = setAutosaveMode(event.target.value);
    persistPreferences({ autosave: autosaveMode, gamesSinceAutosave: 0 });
  });

  onClick('#manualSaveBtn', async () => {
    const btn = $('#manualSaveBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'SALVANDO…';
    }
    const result = await onManualSave?.();
    const localOk = result?.localOk ?? result?.seasonLocalOk ?? (result === true);
    const cloudOk = result?.cloud === true;
    const cloudHint = (() => {
      if (!localOk) return 'MEMÓRIA CHEIA';
      if (cloudOk && result?.careerOk && result?.seasonOk) return 'SALVO!';
      if (result?.cloudReason === 'cloud_inactive') {
        return getAuthToken() ? 'LOCAL (SEM NUVEM)' : 'SALVO LOCAL';
      }
      if (result?.cloudReason === 'empty_batch') return 'LOCAL (VAZIO)';
      const err = result?.cloudErrors?.[0];
      if (err?.status === 401) return 'LOCAL (SESSÃO)';
      if (err?.status === 413) return 'LOCAL (GRANDE)';
      if (err?.status === 429) return 'LOCAL (LIMITE)';
      if (localOk && (result?.seasonOk || result?.careerOk)) return 'LOCAL + PARCIAL';
      if (localOk) return 'SALVO LOCAL';
      return 'SEM SAVE';
    })();
    if (btn) {
      const prev = 'SALVAR';
      btn.textContent = cloudHint;
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.disabled = false;
      }, 1800);
    }
  });

  onClick('#optionsLogout', async () => {
    $('#optionsModal')?.classList.add('hidden');
    await onManualSave?.();
    endBrowserSession();
    clearSessionCareerData();
    location.reload();
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
