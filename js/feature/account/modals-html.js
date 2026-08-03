/** Markup dos modais de conta (home + index). */
export const ACCOUNT_MODALS_HTML = `
  <div id="accountModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
    <div class="modal-card home-account-modal">
      <button id="accountModalClose" class="close" type="button" aria-label="Fechar">×</button>
      <label>CONTA</label>
      <h2 id="accountModalTitle">ENTRAR</h2>
      <p id="accountBackendHint" class="home-account-backend-hint hidden"></p>
      <div id="accountForm" class="home-account-form">
        <div class="home-account-tabs">
          <button type="button" data-account-tab="login" class="active">ENTRAR</button>
          <button type="button" data-account-tab="register">CRIAR CONTA</button>
        </div>
        <label class="home-account-field">
          <span>USUÁRIO</span>
          <input id="accountUsername" type="text" autocomplete="username" maxlength="24">
        </label>
        <label class="home-account-field">
          <span>SENHA</span>
          <input id="accountPassword" type="password" autocomplete="current-password">
        </label>
        <div id="accountRegisterFields" class="home-account-register hidden">
          <label class="home-account-field">
            <span>NOME EXIBIDO</span>
            <input id="accountDisplayName" type="text" maxlength="40" placeholder="opcional">
          </label>
        </div>
        <label id="accountRememberRow" class="home-account-remember">
          <input id="accountRemember" type="checkbox">
          <span>MANTER CONECTADO NESTE DISPOSITIVO</span>
        </label>
        <p id="accountError" class="home-account-error hidden"></p>
        <button id="accountSubmit" type="button" class="home-account-btn primary">CONTINUAR</button>
        <button id="accountPlayLocal" type="button" class="home-account-btn ghost hidden">JOGAR SEM CONTA (SAVE LOCAL)</button>
      </div>
      <div id="accountGoogleSection" class="home-account-google-section hidden">
        <button id="accountGoogleBtn" type="button" class="home-account-google-btn">
          <span class="home-account-google-icon" aria-hidden="true"></span>
          <span>CONTINUAR COM GOOGLE</span>
        </button>
        <div id="accountGoogleMount" class="home-account-google-mount hidden" aria-hidden="true"></div>
      </div>
    </div>
  </div>

  <div id="accountProfileModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="accountProfileTitle">
    <div class="modal-card home-profile-modal">
      <button id="accountProfileClose" class="close" type="button" aria-label="Fechar">×</button>
      <label>PERFIL</label>
      <h2 id="accountProfileTitle">Sua conta</h2>
      <div class="home-profile-photo">
        <button id="accountPhotoBtn" type="button" class="home-profile-photo-btn" aria-label="Escolher foto">
          <canvas id="accountPhotoPreview" class="hidden" width="96" height="96" aria-hidden="true"></canvas>
          <span id="accountPhotoPlaceholder">FOTO</span>
        </button>
        <input id="accountPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        <div id="accountPhotoAdjust" class="home-profile-adjust hidden">
          <label for="accountPhotoZoom" class="home-profile-adjust-label">
            <span>Enquadramento</span>
            <output id="accountPhotoZoomValue" for="accountPhotoZoom">100%</output>
          </label>
          <input id="accountPhotoZoom" type="range" min="100" max="250" step="1" value="100" aria-label="Zoom da foto">
          <small class="home-profile-adjust-hint">Arraste para reposicionar · controle para zoom · duplo clique para trocar.</small>
        </div>
        <small id="accountProfileUsername" class="home-profile-username">@—</small>
      </div>
      <label class="home-account-field">
        <span>Nome exibido</span>
        <input id="accountProfileDisplayName" type="text" maxlength="40" autocomplete="nickname">
      </label>
      <section class="home-profile-storage" aria-label="Armazenamento">
        <small>SAVES NA NUVEM</small>
        <p>Sua carreira é sincronizada com segurança na sua conta.</p>
      </section>
      <p id="accountProfileError" class="home-account-error hidden"></p>
      <div class="home-profile-actions">
        <button id="accountProfileSave" type="button" class="home-account-btn primary">Salvar</button>
      </div>
    </div>
  </div>
`;
