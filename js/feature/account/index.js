import {
  fetchAccountAvatarObjectUrl,
  fetchBackendHealth,
  fetchGoogleAuthConfig,
  getCloudUser,
  initStorageBackend,
  isAuthRememberEnabled,
  isCloudStorageActive,
  loginAccount,
  loginWithGoogleIdToken,
  logoutAccount,
  registerAccount,
  updateAccountProfile,
} from '../../core/storage-api.js';
import { SAVE_KEYS, BRFUT_API_ORIGIN } from '../../core/constants.js';

const AVATAR_PREVIEW_SIZE = 96;
const AVATAR_EXPORT_SIZE = 256;

function drawFramedAvatar(ctx, img, frameSize, zoom, panX, panY) {
  ctx.clearRect(0, 0, frameSize, frameSize);
  ctx.save();
  ctx.beginPath();
  ctx.arc(frameSize / 2, frameSize / 2, frameSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const coverScale = Math.max(frameSize / img.width, frameSize / img.height);
  const scale = coverScale * zoom;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (frameSize - drawW) / 2 + panX;
  const dy = (frameSize - drawH) / 2 + panY;

  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function loadPhotoImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = sourceUrl;
  });
}

function renderFramedAvatar(sourceUrl, zoom, panX, panY, cachedImage = null) {
  return Promise.resolve()
    .then(() => cachedImage || loadPhotoImage(sourceUrl))
    .then(img => {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_EXPORT_SIZE;
      canvas.height = AVATAR_EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível processar a imagem.');
      const panScale = AVATAR_EXPORT_SIZE / AVATAR_PREVIEW_SIZE;
      drawFramedAvatar(
        ctx,
        img,
        AVATAR_EXPORT_SIZE,
        zoom,
        panX * panScale,
        panY * panScale,
      );
      return canvas.toDataURL('image/jpeg', 0.9);
    });
}

/**
 * Modal de conta local (5081 + Documentos/BR Fut).
 * @param {object} opts
 * @param {HTMLElement} opts.modal
 * @param {() => boolean} [opts.hasCareer]
 * @param {(text: string) => void} [opts.onCareerHint]
 * @param {(visible: boolean) => void} [opts.onContinueVisible]
 * @param {(state: { loggedIn: boolean, hasBackend: boolean }) => void} [opts.onAuthChange]
 * @param {() => void} [opts.onPlayLocal]
 */
export function mountAccountPanel({
  modal,
  hasCareer = () => false,
  onCareerHint,
  onContinueVisible,
  onAuthChange,
  onPlayLocal,
} = {}) {
  if (!modal) return { refresh: async () => {}, openLogin: () => {} };

  const $ = sel => modal.querySelector(sel);
  const loggedEl = document.getElementById('accountLogged');
  const openProfileBtn = document.getElementById('accountOpenProfile');
  const profileModal = document.getElementById('accountProfileModal');
  const profileDisplayEl = document.getElementById('accountProfileDisplayName');
  const profileUsernameEl = document.getElementById('accountProfileUsername');
  const profileDataRootEl = document.getElementById('accountProfileDataRoot');
  const profileErrorEl = document.getElementById('accountProfileError');
  const photoBtn = document.getElementById('accountPhotoBtn');
  const photoInput = document.getElementById('accountPhotoInput');
  const photoPreview = document.getElementById('accountPhotoPreview');
  const photoPlaceholder = document.getElementById('accountPhotoPlaceholder');
  const photoAdjustEl = document.getElementById('accountPhotoAdjust');
  const photoZoomEl = document.getElementById('accountPhotoZoom');
  const photoZoomValueEl = document.getElementById('accountPhotoZoomValue');
  const formEl = $('#accountForm');
  const errorEl = $('#accountError');
  const usernameEl = $('#accountUsername');
  const passwordEl = $('#accountPassword');
  const displayEl = $('#accountDisplayName');
  const registerFields = $('#accountRegisterFields');
  const googleSection = document.getElementById('accountGoogleSection');
  const backendHintEl = document.getElementById('accountBackendHint');
  const playLocalBtn = document.getElementById('accountPlayLocal');
  const rememberEl = document.getElementById('accountRemember');
  const rememberRow = document.getElementById('accountRememberRow');
  const googleBtn = document.getElementById('accountGoogleBtn');

  let mode = 'login';
  let hasBackend = false;
  let loggedIn = false;
  let googleReady = false;
  let avatarObjectUrl = '';
  let photoEditorSource = '';
  let photoEditorImage = null;
  let photoZoom = 1;
  let photoPanX = 0;
  let photoPanY = 0;
  let photoNeedsExport = false;
  let photoDragActive = false;
  let photoDragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  let profileDataRoot = '';

  const notifyAuth = (nextLoggedIn, nextHasBackend) => {
    loggedIn = nextLoggedIn;
    hasBackend = nextHasBackend;
    onAuthChange?.({ loggedIn, hasBackend });
  };

  const setError = (message, target = errorEl) => {
    if (!target) return;
    if (!message) {
      target.textContent = '';
      target.classList.add('hidden');
      return;
    }
    target.textContent = message;
    target.classList.remove('hidden');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    setError('');
  };

  const closeProfileModal = () => {
    profileModal?.classList.add('hidden');
    setError('', profileErrorEl);
    resetPhotoEditor();
  };

  const resetPhotoEditor = () => {
    photoEditorSource = '';
    photoEditorImage = null;
    photoZoom = 1;
    photoPanX = 0;
    photoPanY = 0;
    photoNeedsExport = false;
    photoDragActive = false;
    if (photoZoomEl) photoZoomEl.value = '100';
    if (photoZoomValueEl) photoZoomValueEl.textContent = '100%';
    photoAdjustEl?.classList.add('hidden');
    photoBtn?.classList.remove('has-image');
    redrawPhotoPreview();
  };

  const clampPhotoPan = () => {
    const max = Math.max(0, (photoZoom - 1) * (AVATAR_PREVIEW_SIZE / 2));
    photoPanX = Math.max(-max, Math.min(max, photoPanX));
    photoPanY = Math.max(-max, Math.min(max, photoPanY));
  };

  const syncPhotoZoomUi = () => {
    const pct = Math.round(photoZoom * 100);
    if (photoZoomEl) photoZoomEl.value = String(pct);
    if (photoZoomValueEl) photoZoomValueEl.textContent = `${pct}%`;
  };

  const redrawPhotoPreview = () => {
    if (!photoPreview || !photoEditorImage) {
      if (photoPreview) {
        const ctx = photoPreview.getContext('2d');
        ctx?.clearRect(0, 0, AVATAR_PREVIEW_SIZE, AVATAR_PREVIEW_SIZE);
      }
      return;
    }
    const ctx = photoPreview.getContext('2d');
    if (!ctx) return;
    drawFramedAvatar(ctx, photoEditorImage, AVATAR_PREVIEW_SIZE, photoZoom, photoPanX, photoPanY);
  };

  const markPhotoAdjusted = () => {
    photoNeedsExport = true;
    clampPhotoPan();
    redrawPhotoPreview();
  };

  const openModal = () => {
    modal.classList.remove('hidden');
    window.setTimeout(() => usernameEl?.focus(), 80);
  };

  const revokeAvatarUrl = () => {
    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
      avatarObjectUrl = '';
    }
  };

  const setPhotoPreview = async (src, hasImage) => {
    if (!photoPreview || !photoPlaceholder) return;
    if (hasImage && src) {
      photoEditorSource = src;
      try {
        photoEditorImage = await loadPhotoImage(src);
      } catch (error) {
        setError(error?.message || 'Não foi possível carregar a imagem.', profileErrorEl);
        resetPhotoEditor();
        return;
      }
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
      photoAdjustEl?.classList.remove('hidden');
      photoBtn?.classList.add('has-image');
      photoZoom = 1;
      photoPanX = 0;
      photoPanY = 0;
      photoNeedsExport = false;
      syncPhotoZoomUi();
      redrawPhotoPreview();
      return;
    }
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
    resetPhotoEditor();
  };

  const loadProfilePhoto = async user => {
    revokeAvatarUrl();
    if (!user?.hasAvatar) {
      setPhotoPreview('', false);
      return;
    }
    avatarObjectUrl = await fetchAccountAvatarObjectUrl();
    setPhotoPreview(avatarObjectUrl, !!avatarObjectUrl);
  };

  const syncHeaderUser = user => {
    if (openProfileBtn) {
      openProfileBtn.textContent = user?.displayName || user?.username || 'Conta';
    }
  };

  const refreshCareerUi = () => {
    const active = hasCareer();
    onContinueVisible?.(active && (!hasBackend || loggedIn));
    if (!onCareerHint) return;
    if (!active) {
      onCareerHint('');
      return;
    }
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEYS.career) || '{}');
      const club = save.clubName || 'seu clube';
      const division = save.division ? `Série ${save.division}` : 'carreira ativa';
      onCareerHint(`Carreira encontrada: ${club} · ${division}.`);
    } catch {
      onCareerHint('Carreira salva encontrada neste navegador.');
    }
  };

  const renderLoggedOut = backend => {
    notifyAuth(false, backend);
    closeModal();
    closeProfileModal();
    loggedEl?.classList.add('hidden');
    revokeAvatarUrl();
  };

  const renderLoggedIn = user => {
    notifyAuth(true, true);
    closeModal();
    loggedEl?.classList.remove('hidden');
    syncHeaderUser(user);
    refreshCareerUi();
  };

  const renderHidden = () => {
    notifyAuth(false, false);
    closeModal();
    closeProfileModal();
    loggedEl?.classList.add('hidden');
    revokeAvatarUrl();
  };

  const openProfile = async () => {
    const user = getCloudUser();
    if (!user) return;

    setError('', profileErrorEl);
    resetPhotoEditor();

    const health = await fetchBackendHealth();
    profileDataRoot = health?.dataRoot || '';
    if (profileDataRootEl) {
      profileDataRootEl.textContent = profileDataRoot ? `Pasta: ${profileDataRoot}` : '—';
    }
    if (profileDisplayEl) profileDisplayEl.value = user.displayName || user.username || '';
    if (profileUsernameEl) profileUsernameEl.textContent = `@${user.username || '—'}`;

    await loadProfilePhoto(user);
    profileModal?.classList.remove('hidden');
    window.setTimeout(() => profileDisplayEl?.focus(), 80);
  };

  const loadGoogleScript = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-brfut-google]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Google Sign-In indisponível.')), {
          once: true,
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.brfutGoogle = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Sign-In indisponível.'));
      document.head.appendChild(script);
    });

  const syncRememberUi = () => {
    rememberRow?.classList.toggle('hidden', mode !== 'login');
  };

  const authRememberChoice = () => !!rememberEl?.checked;

  const syncRememberCheckbox = () => {
    if (rememberEl) rememberEl.checked = isAuthRememberEnabled();
  };

  const ensureGoogleButton = async () => {
    const mount = document.getElementById('accountGoogleMount');
    if (!googleSection || !mount || !googleBtn) {
      console.warn('[brfut] modal de conta sem mount Google — recarregue com Ctrl+Shift+R');
      return;
    }
    const googleConfig = await fetchGoogleAuthConfig();
    const clientId = googleConfig.clientId || '';
    if (!googleConfig.enabled || !clientId) {
      googleSection.classList.add('hidden');
      return;
    }
    googleSection.classList.remove('hidden');
    if (googleReady) return;
    if (!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
      googleSection.classList.add('hidden');
      console.warn('[brfut] Client ID Google inválido no servidor.');
      return;
    }
    try {
      await loadGoogleScript();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async response => {
          setError('');
          try {
            await loginWithGoogleIdToken(response.credential, {
              remember: authRememberChoice(),
            });
            renderLoggedIn(getCloudUser());
          } catch (error) {
            setError(error?.message || 'Falha no login Google.');
          }
        },
      });
      window.google.accounts.id.renderButton(mount, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'continue_with',
        locale: 'pt-BR',
      });
      googleBtn.addEventListener('click', () => {
        const innerBtn = mount.querySelector('[role="button"]');
        if (innerBtn) {
          innerBtn.click();
          return;
        }
        window.google.accounts.id.prompt();
      });
      googleReady = true;
    } catch (error) {
      googleSection.classList.add('hidden');
      console.warn('[brfut] Google Sign-In não carregou', error);
    }
  };

  const setBackendUnavailableUi = () => {
    backendHintEl?.classList.remove('hidden');
    if (backendHintEl) {
      backendHintEl.textContent =
        'Servidor de contas indisponível neste link. Você pode jogar com save local neste navegador.';
    }
    playLocalBtn?.classList.remove('hidden');
    formEl?.classList.add('hidden');
    googleSection?.classList.add('hidden');
  };

  const setBackendAvailableUi = () => {
    backendHintEl?.classList.add('hidden');
    playLocalBtn?.classList.add('hidden');
    formEl?.classList.remove('hidden');
  };

  const openLogin = async () => {
    setError('');
    const health = await fetchBackendHealth();
    if (!health) {
      setBackendUnavailableUi();
      openModal();
      return;
    }
    setBackendAvailableUi();
    renderLoggedOut(true);
    syncRememberCheckbox();
    syncRememberUi();
    await ensureGoogleButton();
    openModal();
  };

  const refresh = async () => {
    setError('');
    const health = await fetchBackendHealth();
    if (!health) {
      if (BRFUT_API_ORIGIN) {
        renderLoggedOut(true);
        refreshCareerUi();
        return { mode: 'local', backend: false };
      }
      renderHidden();
      return { mode: 'local' };
    }

    const state = await initStorageBackend();
    if (state.mode === 'cloud' && isCloudStorageActive()) {
      renderLoggedIn(getCloudUser());
      refreshCareerUi();
      return state;
    }

    renderLoggedOut(true);
    refreshCareerUi();
    return state;
  };

  modal.querySelectorAll('[data-account-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.accountTab === 'register' ? 'register' : 'login';
      modal.querySelectorAll('[data-account-tab]').forEach(el => {
        el.classList.toggle('active', el.dataset.accountTab === mode);
      });
      registerFields?.classList.toggle('hidden', mode !== 'register');
      syncRememberUi();
      setError('');
    });
  });

  $('#accountSubmit')?.addEventListener('click', async () => {
    setError('');
    const username = usernameEl?.value?.trim() || '';
    const password = passwordEl?.value || '';
    const remember = authRememberChoice();
    if (!username || !password) {
      setError('Informe usuário e senha.');
      return;
    }
    try {
      if (mode === 'register') {
        await registerAccount(username, password, displayEl?.value?.trim() || username, { remember });
      } else {
        await loginAccount(username, password, { remember });
      }
      passwordEl.value = '';
      renderLoggedIn(getCloudUser());
    } catch (error) {
      setError(error?.message || 'Falha na autenticação.');
    }
  });

  playLocalBtn?.addEventListener('click', () => {
    closeModal();
    onPlayLocal?.();
  });

  document.getElementById('accountLogout')?.addEventListener('click', async () => {
    await logoutAccount();
    renderLoggedOut(true);
    refreshCareerUi();
  });

  openProfileBtn?.addEventListener('click', () => {
    openProfile();
  });

  photoBtn?.addEventListener('click', event => {
    if (photoEditorImage && !photoPreview?.classList.contains('hidden')) return;
    photoInput?.click();
  });

  photoInput?.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (file.size > 512_000) {
      setError('Imagem muito grande (máx. 500 KB).', profileErrorEl);
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        void setPhotoPreview(dataUrl, true).then(() => {
          photoNeedsExport = true;
        });
      }
      setError('', profileErrorEl);
    };
    reader.readAsDataURL(file);
  });

  photoBtn?.addEventListener('dblclick', () => {
    photoInput?.click();
  });

  photoZoomEl?.addEventListener('input', () => {
    photoZoom = Number(photoZoomEl.value) / 100;
    syncPhotoZoomUi();
    markPhotoAdjusted();
  });

  photoBtn?.addEventListener('pointerdown', event => {
    if (!photoEditorImage || photoPreview?.classList.contains('hidden')) return;
    photoDragActive = true;
    photoDragStart = {
      x: event.clientX,
      y: event.clientY,
      panX: photoPanX,
      panY: photoPanY,
    };
    photoBtn.setPointerCapture(event.pointerId);
  });

  photoBtn?.addEventListener('pointermove', event => {
    if (!photoDragActive) return;
    photoPanX = photoDragStart.panX + (event.clientX - photoDragStart.x);
    photoPanY = photoDragStart.panY + (event.clientY - photoDragStart.y);
    markPhotoAdjusted();
  });

  const endPhotoDrag = event => {
    if (!photoDragActive) return;
    photoDragActive = false;
    if (event?.pointerId != null) {
      try {
        photoBtn?.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  photoBtn?.addEventListener('pointerup', endPhotoDrag);
  photoBtn?.addEventListener('pointercancel', endPhotoDrag);

  document.getElementById('accountProfileSave')?.addEventListener('click', async () => {
    setError('', profileErrorEl);
    const displayName = profileDisplayEl?.value?.trim() || '';
    if (!displayName) {
      setError('Informe um nome exibido.', profileErrorEl);
      return;
    }
    try {
      const payload = { displayName };
      if (photoNeedsExport && photoEditorSource) {
        payload.avatar = await renderFramedAvatar(
          photoEditorSource,
          photoZoom,
          photoPanX,
          photoPanY,
          photoEditorImage,
        );
      }
      const user = await updateAccountProfile(payload);
      photoNeedsExport = false;
      syncHeaderUser(user);
      await loadProfilePhoto(user);
      closeProfileModal();
    } catch (error) {
      setError(error?.message || 'Não foi possível salvar o perfil.', profileErrorEl);
    }
  });

  document.getElementById('accountModalClose')?.addEventListener('click', closeModal);
  document.getElementById('accountProfileClose')?.addEventListener('click', closeProfileModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  profileModal?.addEventListener('click', event => {
    if (event.target === profileModal) closeProfileModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!modal.classList.contains('hidden')) closeModal();
    if (!profileModal?.classList.contains('hidden')) closeProfileModal();
  });

  return { refresh, openLogin };
}
