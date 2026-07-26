import '../../css/club-crest.css';
import '../../css/crest-editor-compact.css';
import { buildClubCrestSvg } from '../engine/club-crests.js';
import { isUploadedCrestImage, normalizeCrest } from '../engine/custom-clubs.js';

const CREST_PREVIEW_DEBOUNCE_MS = 120;
const CREST_UPLOAD_MAX_BYTES = 512 * 1024;
const CREST_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.svg';

function isAllowedCrestUpload(file) {
  if (!file || file.size > CREST_UPLOAD_MAX_BYTES) return false;
  if (/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) return true;
  return /\.svg$/i.test(file.name || '');
}

function isAllowedCrestDataUrl(dataUrl) {
  return /^data:image\/(png|jpeg|webp|svg\+xml)/i.test(String(dataUrl || ''));
}

function decodeUploadedSvgMarkup(dataUrl, alt = '') {
  try {
    const src = String(dataUrl || '');
    let raw = '';
    if (/^data:image\/svg\+xml;base64,/i.test(src)) {
      raw = atob(src.replace(/^data:image\/svg\+xml;base64,/i, ''));
    } else if (/^data:image\/svg\+xml,/i.test(src)) {
      raw = decodeURIComponent(src.replace(/^data:image\/svg\+xml(?:;charset=utf-8)?,/i, ''));
    }
    if (!/^<svg[\s>]/i.test(raw.trim())) return '';
    const safeAlt = String(alt || '').replace(/"/g, '&quot;');
    return raw.replace(/<svg\b/i, `<svg aria-label="${safeAlt}"`);
  } catch {
    return '';
  }
}

const SHAPE_OPTIONS = [
  ['classic', 'Clássico'],
  ['round', 'Arredondado'],
  ['modern', 'Moderno'],
  ['banner', 'Bandeira'],
  ['circle', 'Circular'],
  ['hex', 'Hexagonal'],
];

const PATTERN_OPTIONS = [
  ['vertical', 'Vertical'],
  ['horizontal', 'Horizontal'],
  ['diagonal', 'Diagonal'],
  ['stripes-h', 'Listras H'],
  ['stripes-v', 'Listras V'],
  ['tricolor-v', 'Tricolor'],
  ['chevron', 'Chevron'],
  ['cross', 'Cruz'],
  ['quarters', 'Quadrantes'],
  ['ring', 'Anel'],
  ['half-arch', 'Meia lua'],
  ['solid', 'Sólido'],
];

/**
 * @param {string} [idPrefix]
 */
export function buildCompactCrestEditorHtml(idPrefix = 'careerCrest') {
  const p = idPrefix;
  const shapeOpts = SHAPE_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const patternOpts = PATTERN_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  return `<fieldset class="nc-crest-fieldset" aria-labelledby="${p}Legend">
    <legend id="${p}Legend">Escudo</legend>
    <div class="nc-crest-body">
      <div class="nc-crest-preview-col">
        <div class="nc-crest-mode" role="radiogroup" aria-label="Tipo de escudo">
          <label class="nc-crest-mode-opt"><input type="radio" name="${p}Mode" id="${p}ModeGenerate" value="generate" checked><span>Gerar</span></label>
          <label class="nc-crest-mode-opt"><input type="radio" name="${p}Mode" id="${p}ModeUpload" value="upload"><span>Upload</span></label>
        </div>
        <div id="${p}Preview" class="nc-crest-preview crest crest--club" aria-hidden="true"></div>
      </div>
      <div class="nc-crest-controls">
        <div id="${p}GeneratePanel" class="nc-crest-panel nc-crest-panel--generate">
          <div class="nc-crest-select-row">
            <label class="nc-crest-field nc-crest-field--compact"><span>Modelo</span><select id="${p}Shape">${shapeOpts}</select></label>
            <label class="nc-crest-field nc-crest-field--compact"><span>Padrão</span><select id="${p}Pattern">${patternOpts}</select></label>
          </div>
          <div class="nc-crest-colors" aria-label="Cores do escudo">
            <label class="nc-crest-swatch"><span>Prim.</span><input id="${p}Primary" type="color" value="#1a3fa8" title="Cor primária"></label>
            <label class="nc-crest-swatch"><span>Sec.</span><input id="${p}Secondary" type="color" value="#ffffff" title="Cor secundária"></label>
            <label class="nc-crest-swatch"><span>Dest.</span><input id="${p}Accent" type="color" value="#ffffff" title="Cor de destaque"></label>
          </div>
          <label class="nc-crest-field nc-crest-field--text"><span>Texto</span><input id="${p}Label" type="text" maxlength="16" placeholder="Sigla ou nome curto" autocomplete="off"></label>
          <div class="nc-crest-text-row">
            <label class="nc-crest-field"><span>Tamanho</span><div class="nc-crest-range"><input id="${p}LabelSize" type="range" min="0" max="28" step="1" value="0"><output id="${p}LabelSizeOut" for="${p}LabelSize">Auto</output></div></label>
            <label class="nc-crest-field nc-crest-field--swatch"><span>Cor texto</span><input id="${p}LabelColor" type="color" value="#ffffff" title="Cor do texto"></label>
            <label class="nc-crest-field nc-crest-field--check"><input id="${p}LabelColorAuto" type="checkbox" checked><span>Auto</span></label>
          </div>
        </div>
        <div id="${p}UploadPanel" class="nc-crest-panel nc-crest-panel--upload" hidden>
          <label class="nc-crest-upload-btn"><span>PNG, JPG ou SVG</span><input id="${p}Upload" type="file" accept="${CREST_UPLOAD_ACCEPT}" hidden></label>
          <button id="${p}ClearUpload" type="button" class="secondary nc-crest-clear-upload" hidden>Remover imagem</button>
        </div>
      </div>
    </div>
  </fieldset>`;
}

/**
 * @param {HTMLElement} container
 * @param {{ idPrefix?: string, getClubName?: () => string, onChange?: () => void }} [options]
 */
export function mountCrestEditor(container, options = {}) {
  const prefix = options.idPrefix || 'careerCrest';
  container.innerHTML = buildCompactCrestEditorHtml(prefix);
  const fieldset = container.querySelector('.nc-crest-fieldset');

  /** @type {Record<string, HTMLElement|null>} */
  const els = {
    preview: document.getElementById(`${prefix}Preview`),
    modeGenerate: document.getElementById(`${prefix}ModeGenerate`),
    modeUpload: document.getElementById(`${prefix}ModeUpload`),
    generatePanel: document.getElementById(`${prefix}GeneratePanel`),
    uploadPanel: document.getElementById(`${prefix}UploadPanel`),
    shape: document.getElementById(`${prefix}Shape`),
    pattern: document.getElementById(`${prefix}Pattern`),
    primary: document.getElementById(`${prefix}Primary`),
    secondary: document.getElementById(`${prefix}Secondary`),
    accent: document.getElementById(`${prefix}Accent`),
    label: document.getElementById(`${prefix}Label`),
    labelSize: document.getElementById(`${prefix}LabelSize`),
    labelSizeOut: document.getElementById(`${prefix}LabelSizeOut`),
    labelColor: document.getElementById(`${prefix}LabelColor`),
    labelColorAuto: document.getElementById(`${prefix}LabelColorAuto`),
    upload: document.getElementById(`${prefix}Upload`),
    clearUpload: document.getElementById(`${prefix}ClearUpload`),
  };

  let crestMode = 'generate';
  let selectedCrestImage = '';
  let previewTimer = 0;

  const getClubName = () => {
    const name = options.getClubName?.();
    return String(name || '').trim() || 'Clube';
  };

  function readLabelSizeValue() {
    const size = Number(els.labelSize?.value);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  function readLabelColorValue() {
    if (els.labelColorAuto?.checked) return '';
    return els.labelColor?.value || '';
  }

  function syncLabelSizeOutput() {
    if (!els.labelSizeOut) return;
    const size = readLabelSizeValue();
    els.labelSizeOut.textContent = size > 0 ? `${size}px` : 'Auto';
  }

  function syncLabelColorUi() {
    const auto = !!els.labelColorAuto?.checked;
    if (els.labelColor) els.labelColor.disabled = auto;
  }

  function readCrestDraft() {
    const image = crestMode === 'upload' ? selectedCrestImage : '';
    return normalizeCrest(
      {
        primary: els.primary?.value,
        secondary: els.secondary?.value,
        accent: els.accent?.value,
        shape: els.shape?.value || 'classic',
        pattern: els.pattern?.value || 'vertical',
        label: els.label?.value || '',
        labelColor: readLabelColorValue(),
        labelSize: readLabelSizeValue(),
        image,
      },
      getClubName(),
    );
  }

  function syncCrestModeUi() {
    const isUpload = crestMode === 'upload';
    if (els.modeGenerate) els.modeGenerate.checked = !isUpload;
    if (els.modeUpload) els.modeUpload.checked = isUpload;
    if (fieldset) {
      fieldset.classList.toggle('is-upload-mode', isUpload);
      fieldset.classList.toggle('is-generate-mode', !isUpload);
      fieldset.classList.toggle(
        'has-upload-image',
        isUpload && isUploadedCrestImage(selectedCrestImage),
      );
    }
    if (els.generatePanel) els.generatePanel.hidden = isUpload;
    if (els.uploadPanel) els.uploadPanel.hidden = !isUpload;
    if (els.clearUpload) {
      els.clearUpload.hidden = !isUpload || !isUploadedCrestImage(selectedCrestImage);
    }
  }

  function setCrestMode(mode) {
    crestMode = mode === 'upload' ? 'upload' : 'generate';
    if (crestMode === 'generate') selectedCrestImage = '';
    syncCrestModeUi();
    updatePreviewNow();
  }

  function updatePreviewNow() {
    if (!els.preview) return;
    const name = getClubName();
    const crest = readCrestDraft();
    els.preview.innerHTML = '';
    if (isUploadedCrestImage(crest.image)) {
      if (/^data:image\/svg\+xml/i.test(crest.image)) {
        const inlineSvg = decodeUploadedSvgMarkup(crest.image, name);
        if (inlineSvg) els.preview.insertAdjacentHTML('beforeend', inlineSvg);
        else {
          const img = document.createElement('img');
          img.alt = name;
          img.src = crest.image;
          els.preview.appendChild(img);
        }
      } else {
        const img = document.createElement('img');
        img.alt = name;
        img.src = crest.image;
        els.preview.appendChild(img);
      }
    } else if (crestMode !== 'upload') {
      // SVG inline — clip-path não funciona em <img src="data:...">; fundo fica opaco
      els.preview.insertAdjacentHTML(
        'beforeend',
        buildClubCrestSvg(name, { ...crest, name }, '-preview'),
      );
    }
    if (els.clearUpload) {
      els.clearUpload.hidden = crestMode !== 'upload' || !isUploadedCrestImage(selectedCrestImage);
    }
  }

  function schedulePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(updatePreviewNow, CREST_PREVIEW_DEBOUNCE_MS);
    options.onChange?.();
  }

  async function handleCrestUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAllowedCrestUpload(file)) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read'));
        reader.readAsDataURL(file);
      });
      if (!isAllowedCrestDataUrl(dataUrl)) return;
      selectedCrestImage = dataUrl;
      crestMode = 'upload';
      syncCrestModeUi();
      schedulePreview();
    } catch {
      /* ignore */
    }
  }

  function handleClearCrestUpload() {
    selectedCrestImage = '';
    crestMode = 'generate';
    syncCrestModeUi();
    schedulePreview();
  }

  els.modeGenerate?.addEventListener('change', () => {
    if (els.modeGenerate.checked) setCrestMode('generate');
  });
  els.modeUpload?.addEventListener('change', () => {
    if (els.modeUpload.checked) setCrestMode('upload');
  });
  els.upload?.addEventListener('change', handleCrestUpload);
  els.clearUpload?.addEventListener('click', handleClearCrestUpload);

  for (const key of ['shape', 'pattern', 'primary', 'secondary', 'accent', 'label', 'labelColor']) {
    els[key]?.addEventListener('input', schedulePreview);
    els[key]?.addEventListener('change', schedulePreview);
  }
  els.labelSize?.addEventListener('input', () => {
    syncLabelSizeOutput();
    schedulePreview();
  });
  els.labelColorAuto?.addEventListener('change', () => {
    syncLabelColorUi();
    schedulePreview();
  });

  syncLabelSizeOutput();
  syncLabelColorUi();
  syncCrestModeUi();
  updatePreviewNow();

  return {
    getCrest: readCrestDraft,
    setCrest(crest = {}, mode = 'generate') {
      if (els.shape) els.shape.value = crest.shape || 'classic';
      if (els.pattern) els.pattern.value = crest.pattern || 'vertical';
      if (els.primary) els.primary.value = crest.primary || '#1a3fa8';
      if (els.secondary) els.secondary.value = crest.secondary || '#ffffff';
      if (els.accent) els.accent.value = crest.accent || '#ffffff';
      if (els.label) els.label.value = crest.label || '';
      if (els.labelSize) els.labelSize.value = String(crest.labelSize || 0);
      if (els.labelColor) els.labelColor.value = crest.labelColor || '#ffffff';
      if (els.labelColorAuto) els.labelColorAuto.checked = !crest.labelColor;
      syncLabelSizeOutput();
      syncLabelColorUi();
      if (isUploadedCrestImage(crest.image)) {
        selectedCrestImage = crest.image;
        crestMode = 'upload';
      } else {
        selectedCrestImage = '';
        crestMode = mode === 'upload' ? 'generate' : mode;
      }
      syncCrestModeUi();
      updatePreviewNow();
    },
    refreshPreview: updatePreviewNow,
  };
}
