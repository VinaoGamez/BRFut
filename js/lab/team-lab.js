import { BRAZILIAN_UFS, divisionLabel } from '../engine/brazilian-clubs-by-uf.js';
import {
  CLUB_COUNTRIES,
  clubCountryLabel,
  isBrazilianClubCountry,
  listFilterCountries,
  resolveClubCountry,
} from '../engine/club-countries.js';
import { buildClubCrestSvg } from '../engine/club-crests.js';
import {
  clearAllBundledCrestImages,
  createCustomClub,
  deleteCustomClub,
  deleteCustomClubs,
  dedupeCustomClubs,
  exportCustomClubsJson,
  importCustomClubs,
  isUploadedCrestImage,
  loadCustomClubs,
  normalizeCrest,
  pruneArgentinaClubsToContinental,
  randomizeGeneratedCrestStyles,
  upsertCustomClub,
} from '../engine/custom-clubs.js';

const PAGE_SIZE = 48;
const SEARCH_DEBOUNCE_MS = 220;
const CREST_PREVIEW_DEBOUNCE_MS = 120;
const CREST_UPLOAD_MAX_BYTES = 512 * 1024;

const els = {
  filterCountry: document.getElementById('tlFilterCountry'),
  filterUf: document.getElementById('tlFilterUf'),
  filterDivision: document.getElementById('tlFilterDivision'),
  search: document.getElementById('tlSearch'),
  count: document.getElementById('tlCount'),
  pager: document.getElementById('tlPager'),
  pagePrev: document.getElementById('tlPagePrev'),
  pageNext: document.getElementById('tlPageNext'),
  pageInfo: document.getElementById('tlPageInfo'),
  clubList: document.getElementById('tlClubList'),
  empty: document.getElementById('tlEmpty'),
  form: document.getElementById('tlForm'),
  formTitle: document.getElementById('tlFormTitle'),
  status: document.getElementById('tlStatus'),
  name: document.getElementById('tlName'),
  country: document.getElementById('tlCountry'),
  uf: document.getElementById('tlUf'),
  ufWrap: document.getElementById('tlUfWrap'),
  division: document.getElementById('tlDivision'),
  shape: document.getElementById('tlShape'),
  pattern: document.getElementById('tlPattern'),
  crestLabel: document.getElementById('tlCrestLabel'),
  labelSize: document.getElementById('tlLabelSize'),
  labelSizeOut: document.getElementById('tlLabelSizeOut'),
  labelColor: document.getElementById('tlLabelColor'),
  labelColorAuto: document.getElementById('tlLabelColorAuto'),
  primary: document.getElementById('tlPrimary'),
  secondary: document.getElementById('tlSecondary'),
  accent: document.getElementById('tlAccent'),
  crestPreview: document.getElementById('tlCrestPreview'),
  crestModeGenerate: document.getElementById('tlCrestModeGenerate'),
  crestModeUpload: document.getElementById('tlCrestModeUpload'),
  crestGeneratePanel: document.getElementById('tlCrestGeneratePanel'),
  crestUploadPanel: document.getElementById('tlCrestUploadPanel'),
  crestUpload: document.getElementById('tlCrestUpload'),
  crestClearUpload: document.getElementById('tlCrestClearUpload'),
  saveBtn: document.getElementById('tlSaveBtn'),
  deleteBtn: document.getElementById('tlDeleteBtn'),
  resetBtn: document.getElementById('tlResetBtn'),
  newBtn: document.getElementById('tlNewBtn'),
  exportBtn: document.getElementById('tlExportBtn'),
  importInput: document.getElementById('tlImportInput'),
  brasfootBtn: document.getElementById('tlBrasfootBtn'),
  selectAllBtn: document.getElementById('tlSelectAllBtn'),
  selectVisibleBtn: document.getElementById('tlSelectVisibleBtn'),
  clearSelectionBtn: document.getElementById('tlClearSelectionBtn'),
  deleteSelectedBtn: document.getElementById('tlDeleteSelectedBtn'),
  dedupeBtn: document.getElementById('tlDedupeBtn'),
  randomizeCrestsBtn: document.getElementById('tlRandomizeCrestsBtn'),
};

/** @type {string|null} */
let selectedId = null;
/** @type {string} */
let selectedCrestImage = '';
/** @type {'generate'|'upload'} */
let crestMode = 'generate';
/** @type {Set<string>} */
const checkedIds = new Set();
/** @type {string[]} */
let visibleClubIds = [];
/** @type {import('../engine/custom-clubs.js').CustomClub[]|null} */
let clubsCache = null;
/** @type {import('../engine/custom-clubs.js').CustomClub[]|null} */
let filteredCache = null;
/** @type {string} */
let filterCacheKey = '';
let listPage = 0;
let searchTimer = 0;
/** @type {Map<string, string>} */
const crestThumbCache = new Map();
/** @type {object|null} */
let brasfootImportPayload = null;
let crestPreviewTimer = 0;

function invalidateClubsCache() {
  clubsCache = null;
  filteredCache = null;
  filterCacheKey = '';
}

function getAllClubs() {
  if (!clubsCache) clubsCache = loadCustomClubs();
  return clubsCache;
}

function getFilterKey() {
  return [
    els.filterCountry?.value || '',
    els.filterUf.value,
    els.filterDivision?.value || '',
    els.search.value.trim().toLowerCase(),
  ].join('|');
}

function getFilteredClubs() {
  const key = getFilterKey();
  if (filteredCache && filterCacheKey === key) return filteredCache;

  const filterCountry = els.filterCountry?.value || '';
  const filterUf = els.filterUf.value;
  const filterDivision = els.filterDivision?.value || '';
  const query = els.search.value.trim().toLowerCase();

  filteredCache = getAllClubs()
    .filter(club => !filterCountry || resolveClubCountry(club) === filterCountry)
    .filter(club => !filterUf || club.uf === filterUf)
    .filter(club => !filterDivision || club.division === filterDivision)
    .filter(club => !query || club.name.toLowerCase().includes(query))
    .sort((a, b) => {
      const countryDiff = clubCountryLabel(a.country).localeCompare(clubCountryLabel(b.country), 'pt-BR');
      if (countryDiff !== 0) return countryDiff;
      const order = { A: 0, B: 1, C: 2, D: 3, REG: 4 };
      const divDiff = (order[a.division] ?? 9) - (order[b.division] ?? 9);
      if (divDiff !== 0) return divDiff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  filterCacheKey = key;
  return filteredCache;
}

function populateCountrySelects() {
  const formOptions = CLUB_COUNTRIES.map(
    country => `<option value="${country.code}">${country.name}</option>`,
  ).join('');
  els.country.innerHTML = formOptions;
  refreshCountryFilter();
}

function refreshCountryFilter() {
  const current = els.filterCountry.value;
  const options = [
    '<option value="">Todos</option>',
    ...listFilterCountries().map(
      country => `<option value="${country.code}">${country.name}</option>`,
    ),
  ].join('');
  els.filterCountry.innerHTML = options;
  if (current && listFilterCountries().some(country => country.code === current)) {
    els.filterCountry.value = current;
  }
}

function syncUfFieldVisibility() {
  const isBrazil = isBrazilianClubCountry(els.country.value);
  if (els.ufWrap) els.ufWrap.hidden = !isBrazil;
  if (els.uf) els.uf.required = isBrazil;
}

function populateUfSelects() {
  const options = BRAZILIAN_UFS.map(
    uf => `<option value="${uf.code}">${uf.code} — ${uf.name}</option>`,
  ).join('');

  els.filterUf.insertAdjacentHTML(
    'beforeend',
    BRAZILIAN_UFS.map(uf => `<option value="${uf.code}">${uf.code}</option>`).join(''),
  );
  els.uf.innerHTML = `<option value="" disabled selected>Selecione…</option>${options}`;
}

function setStatus(message, type = '') {
  els.status.textContent = message || '';
  els.status.className = `tl-status${type ? ` is-${type}` : ''}`;
}

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

function readFormClub() {
  const image = crestMode === 'upload' ? selectedCrestImage : '';
  const existing = selectedId ? getAllClubs().find(entry => entry.id === selectedId) : null;
  return createCustomClub({
    id: selectedId || undefined,
    name: els.name.value,
    country: els.country.value,
    uf: els.uf.value,
    division: els.division.value,
    crest: normalizeCrest(
      {
        slug: existing?.crest?.slug,
        primary: els.primary.value,
        secondary: els.secondary.value,
        accent: els.accent.value,
        shape: els.shape?.value || 'classic',
        pattern: els.pattern.value,
        label: els.crestLabel?.value || '',
        labelColor: readLabelColorValue(),
        labelSize: readLabelSizeValue(),
        image,
      },
      els.name.value,
    ),
  });
}

function crestVisualKey(club) {
  const crest = club.crest || {};
  return [
    club.id || club.name,
    crest.shape,
    crest.pattern,
    crest.primary,
    crest.secondary,
    crest.accent,
    crest.label,
    crest.labelColor,
    crest.labelSize,
  ].join('|');
}

function generatedCrestSrc(club) {
  const key = `${crestVisualKey(club)}|gen`;
  if (crestThumbCache.has(key)) return crestThumbCache.get(key);
  const svg = buildClubCrestSvg(club.name, { ...club.crest, name: club.name });
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (crestThumbCache.size > 400) crestThumbCache.clear();
  crestThumbCache.set(key, url);
  return url;
}

function syncCrestModeUi() {
  const isUpload = crestMode === 'upload';
  els.crestModeGenerate.checked = !isUpload;
  els.crestModeUpload.checked = isUpload;
  els.crestGeneratePanel.hidden = isUpload;
  els.crestUploadPanel.hidden = !isUpload;
  els.crestClearUpload.hidden = !isUploadedCrestImage(selectedCrestImage);
}

function setCrestMode(mode) {
  crestMode = mode === 'upload' ? 'upload' : 'generate';
  if (crestMode === 'generate') selectedCrestImage = '';
  syncCrestModeUi();
  updateCrestPreviewNow();
}

async function loadBrasfootPackage() {
  if (brasfootImportPayload) return brasfootImportPayload;
  const response = await fetch('./data/brasfoot-clubs-import.json');
  if (!response.ok) throw new Error('Brasfoot package not found');
  brasfootImportPayload = await response.json();
  return brasfootImportPayload;
}

function updateCrestPreviewNow() {
  const club = readFormClub();
  const name = club.name || 'Clube';
  els.crestPreview.innerHTML = '';
  const img = document.createElement('img');
  img.alt = name;
  const svgFallback = generatedCrestSrc(club);
  img.onerror = () => {
    img.onerror = null;
    img.src = svgFallback;
  };
  if (isUploadedCrestImage(club.crest?.image)) {
    img.src = club.crest.image;
  } else {
    img.src = svgFallback;
  }
  els.crestPreview.appendChild(img);
  els.crestClearUpload.hidden = !isUploadedCrestImage(selectedCrestImage);
}

function scheduleCrestPreview() {
  window.clearTimeout(crestPreviewTimer);
  crestPreviewTimer = window.setTimeout(updateCrestPreviewNow, CREST_PREVIEW_DEBOUNCE_MS);
}

function crestThumbSrc(club) {
  return generatedCrestSrc(club);
}

function updateSelectionUi() {
  const n = checkedIds.size;
  els.deleteSelectedBtn.hidden = n === 0;
  els.deleteSelectedBtn.textContent = n === 1 ? 'Excluir 1 selecionado' : `Excluir ${n} selecionados`;
}

function locationLabel(club) {
  const countryCode = resolveClubCountry(club);
  return countryCode === 'BRA'
    ? `${club.uf} · ${divisionLabel(club.division)}`
    : `${clubCountryLabel(countryCode)} · ${divisionLabel(club.division)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updatePager(total, pageCount) {
  const showPager = total > PAGE_SIZE;
  els.pager.hidden = !showPager;
  if (!showPager) return;
  els.pageInfo.textContent = `Página ${listPage + 1} de ${pageCount} · ${PAGE_SIZE} por página`;
  els.pagePrev.disabled = listPage <= 0;
  els.pageNext.disabled = listPage >= pageCount - 1;
}

function renderClubList({ resetPage = false } = {}) {
  if (resetPage) listPage = 0;

  const clubs = getFilteredClubs();
  visibleClubIds = clubs.map(club => club.id);
  const total = clubs.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (listPage >= pageCount) listPage = pageCount - 1;

  const start = listPage * PAGE_SIZE;
  const pageClubs = clubs.slice(start, start + PAGE_SIZE);

  els.empty.hidden = total > 0;
  updatePager(total, pageCount);

  const selectedCount = checkedIds.size;
  const totalAll = getAllClubs().length;
  els.count.textContent = selectedCount > 0
    ? `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'} · ${total} filtrado${total === 1 ? '' : 's'} · ${totalAll} total`
    : total === totalAll
      ? `${total} clube${total === 1 ? '' : 's'}`
      : `${total} de ${totalAll} clubes`;

  const html = pageClubs.map(club => {
    const isChecked = checkedIds.has(club.id);
    const isActive = club.id === selectedId;
    const thumb = crestThumbSrc(club);
    return `<li><button type="button" class="tl-club-item${isActive ? ' is-active' : ''}${isChecked ? ' is-checked' : ''}" data-id="${escapeHtml(club.id)}">` +
      `<input type="checkbox" class="tl-club-check" ${isChecked ? 'checked' : ''} title="Selecionar para excluir">` +
      `<div class="crest crest--club"><img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async"></div>` +
      `<div class="tl-club-meta"><strong>${escapeHtml(club.name)}</strong><small>${escapeHtml(locationLabel(club))}</small></div>` +
      '</button></li>';
  }).join('');

  els.clubList.innerHTML = html;
  updateSelectionUi();
}

function scheduleListRender(resetPage = false) {
  window.requestAnimationFrame(() => renderClubList({ resetPage }));
}

function scheduleSearchRender() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => scheduleListRender(true), SEARCH_DEBOUNCE_MS);
}

function updateActiveListItem() {
  els.clubList.querySelectorAll('.tl-club-item.is-active').forEach(el => el.classList.remove('is-active'));
  if (!selectedId) return;
  els.clubList.querySelector(`.tl-club-item[data-id="${CSS.escape(selectedId)}"]`)?.classList.add('is-active');
}

function fillForm(club, { refreshList = false } = {}) {
  selectedId = club?.id || null;
  const image = club?.crest?.image || '';
  if (isUploadedCrestImage(image)) {
    selectedCrestImage = image;
    crestMode = 'upload';
  } else {
    selectedCrestImage = '';
    crestMode = 'generate';
  }
  els.formTitle.textContent = club ? 'Editar clube' : 'Novo clube';
  els.name.value = club?.name || '';
  els.country.value = club ? resolveClubCountry(club) : 'BRA';
  els.uf.value = club?.uf || '';
  syncUfFieldVisibility();
  els.division.value = club?.division || 'C';
  if (els.shape) els.shape.value = club?.crest?.shape || 'classic';
  els.pattern.value = club?.crest?.pattern || 'vertical';
  if (els.crestLabel) els.crestLabel.value = club?.crest?.label || '';
  if (els.labelSize) els.labelSize.value = String(club?.crest?.labelSize || 0);
  if (els.labelColor) els.labelColor.value = club?.crest?.labelColor || '#ffffff';
  if (els.labelColorAuto) els.labelColorAuto.checked = !club?.crest?.labelColor;
  syncLabelSizeOutput();
  syncLabelColorUi();
  els.primary.value = club?.crest?.primary || '#1a3fa8';
  els.secondary.value = club?.crest?.secondary || '#ffffff';
  els.accent.value = club?.crest?.accent || '#ffffff';
  els.deleteBtn.hidden = !club;
  els.saveBtn.textContent = club ? 'Atualizar clube' : 'Salvar clube';
  syncCrestModeUi();
  scheduleCrestPreview();
  if (refreshList) scheduleListRender();
  else updateActiveListItem();
}

function selectClub(id) {
  const club = getAllClubs().find(entry => entry.id === id);
  if (!club) return;
  fillForm(club);
  setStatus('');
}

function resetForm() {
  fillForm(null);
  setStatus('');
}

function handleSave(event) {
  event.preventDefault();
  const before = selectedId ? getAllClubs().find(entry => entry.id === selectedId) : null;
  const club = readFormClub();
  const result = upsertCustomClub(club);
  if (!result.ok) {
    setStatus(result.error, 'error');
    return;
  }
  invalidateClubsCache();
  crestThumbCache.clear();
  selectedId = result.club.id;

  const loc = locationLabel(result.club);
  let message = `"${result.club.name}" salvo (${loc}). Entra em novas carreiras.`;
  if (before && before.uf !== result.club.uf && els.filterUf.value === before.uf) {
    els.filterUf.value = '';
    message += ' Filtro UF limpo para manter o clube visível na lista.';
  }
  setStatus(message, 'ok');
  refreshCountryFilter();
  fillForm(result.club, { refreshList: true });
}

function handleDeleteSelected() {
  const ids = [...checkedIds];
  if (!ids.length) return;
  const label = ids.length === 1 ? '1 clube selecionado' : `${ids.length} clubes selecionados`;
  if (!window.confirm(`Excluir ${label}?\n\nEsta ação não pode ser desfeita.`)) return;

  const result = deleteCustomClubs(ids);
  if (!result.ok) {
    setStatus(result.error, 'error');
    return;
  }

  invalidateClubsCache();
  ids.forEach(id => {
    checkedIds.delete(id);
    crestThumbCache.delete(id);
  });
  if (selectedId && ids.includes(selectedId)) resetForm();
  else scheduleListRender();
  refreshCountryFilter();
  setStatus(`${result.removed} clube(s) excluído(s).`, 'ok');
}

function handleSelectAll() {
  for (const club of getAllClubs()) checkedIds.add(club.id);
  scheduleListRender();
  setStatus(`${getAllClubs().length} clube(s) selecionado(s).`, 'ok');
}

function handleSelectVisible() {
  for (const id of visibleClubIds) checkedIds.add(id);
  scheduleListRender();
  setStatus(`${visibleClubIds.length} clube(s) marcado(s) na lista filtrada.`, 'ok');
}

function handleClearSelection() {
  if (!checkedIds.size) return;
  checkedIds.clear();
  scheduleListRender();
  setStatus('Seleção limpa.', 'ok');
}

function handleDelete() {
  if (!selectedId) return;
  const club = getAllClubs().find(entry => entry.id === selectedId);
  const label = club?.name || 'este clube';
  if (!window.confirm(`Excluir ${label}?`)) return;
  const result = deleteCustomClub(selectedId);
  if (!result.ok) {
    setStatus(result.error, 'error');
    return;
  }
  invalidateClubsCache();
  crestThumbCache.delete(selectedId);
  checkedIds.delete(selectedId);
  resetForm();
  setStatus('Clube excluído.', 'ok');
  refreshCountryFilter();
  scheduleListRender();
}

function handleExport() {
  const blob = new Blob([exportCustomClubsJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `brfut-custom-clubs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('JSON exportado.', 'ok');
}

async function runImport(data, { replace = false, label = 'importação' } = {}) {
  const clubs = Array.isArray(data) ? data : data?.clubs;
  if (!Array.isArray(clubs) || !clubs.length) {
    setStatus('Arquivo JSON inválido ou vazio.', 'error');
    return false;
  }
  setStatus(`Importando ${clubs.length} clubes…`);
  await new Promise(resolve => window.setTimeout(resolve, 0));

  const result = importCustomClubs(clubs, { replace });
  if (!result.ok) {
    setStatus(result.error, 'error');
    return false;
  }
  invalidateClubsCache();
  crestThumbCache.clear();
  checkedIds.clear();
  resetForm();
  refreshCountryFilter();
  scheduleListRender(true);
  const parts = [`${result.count} clube(s) no Lab`];
  if (result.added) parts.push(`${result.added} novos`);
  if (result.updated) parts.push(`${result.updated} atualizados`);
  if (result.skipped) parts.push(`${result.skipped} ignorados (nome duplicado)`);
  if (result.removedDuplicates) parts.push(`${result.removedDuplicates} duplicados removidos`);
  setStatus(`${parts.join(' · ')} após ${label}.`, 'ok');
  return true;
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const replace = window.confirm(
      'Substituir todos os clubes customizados pelos do arquivo?\n\nOK = substituir · Cancelar = mesclar',
    );
    await runImport(parsed, { replace, label: 'importação do arquivo' });
  } catch {
    setStatus('Arquivo JSON inválido.', 'error');
  }
}

function handleDedupe() {
  const before = getAllClubs().length;
  const result = dedupeCustomClubs();
  if (!result.ok) {
    setStatus(result.error, 'error');
    return;
  }
  invalidateClubsCache();
  crestThumbCache.clear();
  checkedIds.clear();
  if (selectedId && !getAllClubs().some(club => club.id === selectedId)) resetForm();
  else scheduleListRender();
  if (!result.removed) {
    setStatus(`Nenhum duplicado encontrado (${before} clubes).`, 'ok');
    return;
  }
  refreshCountryFilter();
  setStatus(`${result.removed} duplicado(s) removido(s). Restam ${result.count} clubes.`, 'ok');
}

async function handleBrasfootImport() {
  let totalHint = '';
  try {
    const parsed = await loadBrasfootPackage();
    const count = Array.isArray(parsed?.clubs) ? parsed.clubs.length : parsed?.stats?.after;
    if (count) totalHint = ` (~${count})`;
  } catch {
    /* ignore */
  }
  const replace = window.confirm(
    `Carregar clubes do Brasfoot${totalHint}?\n\n` +
      'OK = substituir a lista atual (recomendado após correção de países)\n' +
      'Cancelar = mesclar',
  );
  els.brasfootBtn.disabled = true;
  setStatus('Carregando clubes do Brasfoot…');
  try {
    const parsed = await loadBrasfootPackage();
    await runImport(parsed, { replace, label: 'importação Brasfoot' });
  } catch {
    setStatus('Falha ao carregar Brasfoot. Verifique o build local (5081).', 'error');
  } finally {
    els.brasfootBtn.disabled = false;
  }
}

function handleClubListClick(event) {
  const check = event.target.closest('.tl-club-check');
  if (check) {
    event.stopPropagation();
    return;
  }
  const btn = event.target.closest('.tl-club-item');
  if (!btn?.dataset.id) return;
  selectClub(btn.dataset.id);
}

function handleClubListChange(event) {
  const check = event.target.closest('.tl-club-check');
  if (!check) return;
  const btn = check.closest('.tl-club-item');
  const id = btn?.dataset.id;
  if (!id) return;
  if (check.checked) checkedIds.add(id);
  else checkedIds.delete(id);
  btn.classList.toggle('is-checked', check.checked);
  updateSelectionUi();
}

async function handleCrestUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    setStatus('Use PNG, JPG ou WebP.', 'error');
    return;
  }
  if (file.size > CREST_UPLOAD_MAX_BYTES) {
    setStatus('Imagem grande demais (máx. 512 KB).', 'error');
    return;
  }
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith('data:image/')) {
      setStatus('Arquivo de imagem inválido.', 'error');
      return;
    }
    selectedCrestImage = dataUrl;
    crestMode = 'upload';
    syncCrestModeUi();
    scheduleCrestPreview();
    setStatus('Imagem carregada. Salve o clube para gravar.', 'ok');
  } catch {
    setStatus('Falha ao ler a imagem.', 'error');
  }
}

function handleClearCrestUpload() {
  selectedCrestImage = '';
  crestMode = 'generate';
  syncCrestModeUi();
  scheduleCrestPreview();
  setStatus('Voltou ao escudo gerado.', 'ok');
}

function handleRandomizeCrests() {
  const total = getAllClubs().length;
  if (!total) {
    setStatus('Nenhum clube na lista.', 'error');
    return;
  }
  if (
    !window.confirm(
      `Sortear modelos e padrões para ${total} clube(s)?\n\nMantém cor primária e secundária de cada time. Uploads manuais não são alterados.`,
    )
  ) {
    return;
  }

  setStatus('Sorteando escudos…');
  window.setTimeout(() => {
    const result = randomizeGeneratedCrestStyles({ force: true });
    if (!result.ok) {
      setStatus(result.error, 'error');
      return;
    }
    invalidateClubsCache();
    crestThumbCache.clear();
    if (selectedId) {
      const club = getAllClubs().find(entry => entry.id === selectedId);
      if (club) fillForm(club);
    }
    scheduleListRender();
    setStatus(`${result.updated} escudo(s) randomizado(s). Cores primária/secundária preservadas.`, 'ok');
  }, 0);
}

function bindEvents() {
  els.form.addEventListener('submit', handleSave);
  els.deleteBtn.addEventListener('click', handleDelete);
  els.resetBtn.addEventListener('click', resetForm);
  els.newBtn.addEventListener('click', resetForm);
  els.exportBtn.addEventListener('click', handleExport);
  els.importInput.addEventListener('change', handleImport);
  els.brasfootBtn?.addEventListener('click', handleBrasfootImport);
  els.selectAllBtn?.addEventListener('click', handleSelectAll);
  els.selectVisibleBtn?.addEventListener('click', handleSelectVisible);
  els.clearSelectionBtn?.addEventListener('click', handleClearSelection);
  els.deleteSelectedBtn?.addEventListener('click', handleDeleteSelected);
  els.dedupeBtn?.addEventListener('click', handleDedupe);
  els.randomizeCrestsBtn?.addEventListener('click', handleRandomizeCrests);
  els.crestModeGenerate?.addEventListener('change', () => {
    if (els.crestModeGenerate.checked) setCrestMode('generate');
  });
  els.crestModeUpload?.addEventListener('change', () => {
    if (els.crestModeUpload.checked) setCrestMode('upload');
  });
  els.crestUpload?.addEventListener('change', handleCrestUpload);
  els.crestClearUpload?.addEventListener('click', handleClearCrestUpload);
  els.labelSize?.addEventListener('input', () => {
    syncLabelSizeOutput();
    scheduleCrestPreview();
  });
  els.labelColor?.addEventListener('input', scheduleCrestPreview);
  els.labelColorAuto?.addEventListener('change', () => {
    syncLabelColorUi();
    scheduleCrestPreview();
  });
  els.filterCountry?.addEventListener('change', () => scheduleListRender(true));
  els.country?.addEventListener('change', () => {
    syncUfFieldVisibility();
    scheduleCrestPreview();
  });
  els.filterUf.addEventListener('change', () => scheduleListRender(true));
  els.filterDivision?.addEventListener('change', () => scheduleListRender(true));
  els.search.addEventListener('input', scheduleSearchRender);
  els.pagePrev?.addEventListener('click', () => {
    if (listPage > 0) {
      listPage -= 1;
      scheduleListRender();
    }
  });
  els.pageNext?.addEventListener('click', () => {
    const pageCount = Math.max(1, Math.ceil(getFilteredClubs().length / PAGE_SIZE));
    if (listPage < pageCount - 1) {
      listPage += 1;
      scheduleListRender();
    }
  });
  els.clubList.addEventListener('click', handleClubListClick);
  els.clubList.addEventListener('change', handleClubListChange);

  for (const input of [els.name, els.shape, els.pattern, els.crestLabel, els.labelSize, els.labelColor, els.primary, els.secondary, els.accent]) {
    if (!input) continue;
    input.addEventListener('input', scheduleCrestPreview);
    input.addEventListener('change', scheduleCrestPreview);
  }
}

function runLabMigrations() {
  const stripResult = clearAllBundledCrestImages();
  if (stripResult.ok && stripResult.cleared > 0) {
    invalidateClubsCache();
    crestThumbCache.clear();
    setStatus(`${stripResult.cleared} escudo(s) de pacote removido(s) — use «Gerar escudo» ou upload manual.`, 'ok');
  }

  const styleResult = randomizeGeneratedCrestStyles();
  if (styleResult.ok && styleResult.updated > 0) {
    invalidateClubsCache();
    crestThumbCache.clear();
    setStatus(
      `${styleResult.updated} escudo(s) com modelos/padrões sorteados — cores primária e secundária mantidas.`,
      'ok',
    );
  }

  const argPrune = pruneArgentinaClubsToContinental();
  if (argPrune.ok && argPrune.removed > 0) {
    invalidateClubsCache();
    crestThumbCache.clear();
    checkedIds.clear();
    if (selectedId && !getAllClubs().some(club => club.id === selectedId)) resetForm();
    else scheduleListRender(true);
    refreshCountryFilter();
    setStatus(
      `Lista argentina reduzida: ${argPrune.keptArg} clubes (Libertadores/Sudamericana recentes). ${argPrune.removed} removido(s).`,
      'ok',
    );
  }
}

function scheduleLabMigrations() {
  const run = () => runLabMigrations();
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 80);
  }
}

function init() {
  populateCountrySelects();
  populateUfSelects();
  bindEvents();

  syncLabelSizeOutput();
  syncLabelColorUi();

  resetForm();
  scheduleListRender(true);
  scheduleLabMigrations();

  loadBrasfootPackage()
    .then(parsed => {
      const count = Array.isArray(parsed?.clubs) ? parsed.clubs.length : parsed?.stats?.after;
      if (count && els.brasfootBtn) {
        els.brasfootBtn.textContent = `Importar Brasfoot (${count})`;
      }
    })
    .catch(() => {});
}

init();
