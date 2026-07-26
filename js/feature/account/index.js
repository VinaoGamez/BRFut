import {
  fetchAccountAvatarObjectUrl,
  fetchBackendHealth,
  getCloudUser,
  initStorageBackend,
  isCloudStorageActive,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateAccountProfile,
} from '../../core/storage-api.js';
import { SAVE_KEYS } from '../../core/constants.js';

const AVATAR_EXPORT_SIZE = 256;

function renderFramedAvatar(sourceUrl, zoom, panX, panY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_EXPORT_SIZE;
      canvas.height = AVATAR_EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem.'));
        return;
      }

      ctx.beginPath();
      ctx.arc(AVATAR_EXPORT_SIZE / 2, AVATAR_EXPORT_SIZE / 2, AVATAR_EXPORT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const coverScale = Math.max(
        AVATAR_EXPORT_SIZE / img.width,
        AVATAR_EXPORT_SIZE / img.height,
      );
      const scale = coverScale * zoom;
      const previewScale = AVATAR_EXPORT_SIZE / 96;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (AVATAR_EXPORT_SIZE - drawW) / 2 + panX * previewScale;
      const dy = (AVATAR_EXPORT_SIZE - drawH) / 2 + panY * previewScale;

      ctx.drawImage(img, dx, dy, drawW, drawH);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = sourceUrl;
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
 */
export function mountAccountPanel({
  modal,
  hasCareer = () => false,
  onCareerHint,
  onContinueVisible,
  onAuthChange,
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

  let mode = 'login';
  let hasBackend = false;
  let loggedIn = false;
  let avatarObjectUrl = '';
  let photoEditorSource = '';
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
    photoZoom = 1;
    photoPanX = 0;
    photoPanY = 0;
    photoNeedsExport = false;
    photoDragActive = false;
    if (photoZoomEl) photoZoomEl.value = '100';
    if (photoZoomValueEl) photoZoomValueEl.textContent = '100%';
    photoAdjustEl?.classList.add('hidden');
    photoBtn?.classList.remove('has-image');
    applyPhotoTransform();
  };

  const clampPhotoPan = () => {
    const max = Math.max(0, (photoZoom - 1) * 48);
    photoPanX = Math.max(-max, Math.min(max, photoPanX));
    photoPanY = Math.max(-max, Math.min(max, photoPanY));
  };

  const syncPhotoZoomUi = () => {
    const pct = Math.round(photoZoom * 100);
    if (photoZoomEl) photoZoomEl.value = String(pct);
    if (photoZoomValueEl) photoZoomValueEl.textContent = `${pct}%`;
  };

  const applyPhotoTransform = () => {
    if (!photoPreview) return;
    photoPreview.style.transform = `translate(${photoPanX}px, ${photoPanY}px) scale(${photoZoom})`;
  };

  const markPhotoAdjusted = () => {
    photoNeedsExport = true;
    clampPhotoPan();
    applyPhotoTransform();
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

  const setPhotoPreview = (src, hasImage) => {
    if (!photoPreview || !photoPlaceholder) return;
    if (hasImage && src) {
      photoEditorSource = src;
      photoPreview.src = src;
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
      photoAdjustEl?.classList.remove('hidden');
      photoBtn?.classList.add('has-image');
      photoZoom = 1;
      photoPanX = 0;
      photoPanY = 0;
      photoNeedsExport = false;
      syncPhotoZoomUi();
      applyPhotoTransform();
      return;
    }
    photoPreview.removeAttribute('src');
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

  const openLogin = async () => {
    setError('');
    const health = await fetchBackendHealth();
    if (!health) return;
    renderLoggedOut(true);
    openModal();
  };

  const refresh = async () => {
    setError('');
    const health = await fetchBackendHealth();
    if (!health) {
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
      setError('');
    });
  });

  $('#accountSubmit')?.addEventListener('click', async () => {
    setError('');
    const username = usernameEl?.value?.trim() || '';
    const password = passwordEl?.value || '';
    if (!username || !password) {
      setError('Informe usuário e senha.');
      return;
    }
    try {
      if (mode === 'register') {
        await registerAccount(username, password, displayEl?.value?.trim() || username);
      } else {
        await loginAccount(username, password);
      }
      passwordEl.value = '';
      renderLoggedIn(getCloudUser());
    } catch (error) {
      setError(error?.message || 'Falha na autenticação.');
    }
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
    if (photoPreview?.src && !photoPreview.classList.contains('hidden')) return;
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
        setPhotoPreview(dataUrl, true);
        photoNeedsExport = true;
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
    if (!photoPreview?.src || photoPreview.classList.contains('hidden')) return;
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
