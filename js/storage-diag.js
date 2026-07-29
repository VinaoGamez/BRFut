import { scanLocalCareerStorage, ensureSlotPlayable, repairSlotFromLocalStorage } from './core/career-storage-health.js';
import { getActiveSlotId, getLastPlayedSlot } from './core/career-slot-manager.js';

function renderScan(scan) {
  const rows = scan.keys
    .map(
      row =>
        `<tr><td><code>${row.key}</code></td><td>${row.chars.toLocaleString('pt-BR')}</td><td>${row.hasCareerClub === undefined ? '—' : row.hasCareerClub ? 'sim' : 'não'}</td></tr>`,
    )
    .join('');
  const slot = getLastPlayedSlot();
  return `
    <p class="${scan.playable ? 'ok' : 'err'}"><strong>Jogável:</strong> ${scan.playable ? 'sim' : 'não — falta brfut-career ou bundle do slot'}</p>
    <p><strong>Slot ativo:</strong> ${getActiveSlotId() || '—'} · <strong>Último:</strong> ${slot?.id || '—'} (${slot?.clubName || '—'})</p>
    <h2>Chaves locais</h2>
    <table><thead><tr><th>Chave</th><th>Chars</th><th>Clube?</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhuma chave BRFut</td></tr>'}</tbody></table>
    <h2>Índice</h2>
    <pre>${JSON.stringify(scan.index, null, 2)}</pre>
  `;
}

document.getElementById('scanBtn')?.addEventListener('click', () => {
  document.getElementById('out').innerHTML = renderScan(scanLocalCareerStorage());
});

document.getElementById('repairBtn')?.addEventListener('click', () => {
  const slotId = getActiveSlotId() || getLastPlayedSlot()?.id;
  if (!slotId) {
    document.getElementById('out').innerHTML = '<p class="err">Sem slot ativo.</p>';
    return;
  }
  repairSlotFromLocalStorage(slotId);
  const result = ensureSlotPlayable(slotId);
  document.getElementById('out').innerHTML =
    `<p class="${result.ok ? 'ok' : 'err'}">Reparo: ${result.ok ? 'OK' : result.reason}</p>` + renderScan(result.scan);
});

document.getElementById('scanBtn')?.click();
