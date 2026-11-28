/**
 * Boletim do departamento médico (v2) — decisão de tratamento pós-lesão.
 * Mantém os ids #treatmentModal / #treatmentConservative / #treatmentSurgery
 * (os cliques continuam no engine); aqui só se monta o conteúdo.
 */
import { escapeHtml as esc } from '../../core/html-safe.js';

const PART_LABEL = {
  knee: 'joelho',
  ankle: 'tornozelo',
  foot: 'pé',
  calf: 'panturrilha',
  hamstring: 'posterior da coxa',
  quadriceps: 'quadríceps',
  thigh: 'coxa',
  adductor: 'adutor',
  leg: 'perna',
};

// Ponto da lesão na silhueta (viewBox 120×210). Lado direito do atleta = esquerda da figura.
const PART_Y = { knee: 150, ankle: 190, foot: 200, calf: 168, hamstring: 128, quadriceps: 124, thigh: 126, adductor: 112, leg: 160 };
const markerFor = (part, side) => {
  const y = PART_Y[part];
  if (!y) return { x: 60, y: 70 };
  const x = side === 'left' ? 71 : 49;
  return { x, y };
};

export function bodyMapSvg(part, side, size = 84) {
  const { x, y } = markerFor(part, side);
  const h = Math.round(size * 1.75);
  return `<svg class="mb2-body" width="${size}" height="${h}" viewBox="0 0 120 210" aria-hidden="true">
    <g fill="#16294A" stroke="#1E3352" stroke-width="2"><circle cx="60" cy="20" r="14"/><rect x="38" y="38" width="44" height="66" rx="10"/>
    <rect x="20" y="42" width="14" height="58" rx="7"/><rect x="86" y="42" width="14" height="58" rx="7"/>
    <rect x="40" y="104" width="17" height="96" rx="8"/><rect x="63" y="104" width="17" height="96" rx="8"/></g>
    <circle cx="${x}" cy="${y}" r="13" fill="#FF4D5E33"/><circle cx="${x}" cy="${y}" r="6" fill="#FF4D5E"/></svg>`;
}

export const MODAL_HTML = `
<div id="treatmentModal" class="modal hidden">
  <div class="modal-card treatment-modal mb2" role="dialog" aria-modal="true" aria-labelledby="treatmentPlayerName">
    <header class="mb2-head">
      <span class="mb2-cross" aria-hidden="true">+</span>
      <div class="mb2-head-copy">
        <span class="mb2-kicker" id="treatmentKicker">BOLETIM DO DEPARTAMENTO MÉDICO</span>
        <h2 id="treatmentPlayerName"></h2>
      </div>
      <span class="mb2-case" id="treatmentCase"></span>
    </header>
    <div class="mb2-body-wrap">
      <section class="mb2-player" id="treatmentPlayer"></section>
      <header class="mb2-sec"><h3>Compare as opções</h3></header>
      <div class="mb2-compare" id="treatmentCompare"></div>
      <div class="mb2-cash" id="treatmentCash"></div>
    </div>
    <footer class="mb2-foot">
      <span class="mb2-foot-note">Decisão obrigatória · fica salva se você sair do jogo</span>
      <button id="treatmentFinance" type="button" class="mb2-btn is-ghost hidden">VER FINANÇAS</button>
      <button id="treatmentConservative" type="button" class="mb2-btn"></button>
      <button id="treatmentSurgery" type="button" class="mb2-btn"></button>
    </footer>
  </div>
</div>`;

const pct = delta => {
  const n = Math.round(Math.abs(Number(delta) || 0) * 100);
  if (!n) return '0%';
  return `${delta > 0 ? '+' : '−'}${n}%`;
};

/**
 * @param {object} d dados montados pelo engine
 */
export function renderMedicalBulletin($, d) {
  const { player, injury, options, money, cash, canSurgery, recommended, caseIndex, caseTotal, returnDates, gamesMissed, substitute, starter, medLabel } = d;
  const part = PART_LABEL[injury.bodyPart] || '';
  const sideLabel = injury.side === 'left' ? 'esquerdo' : injury.side === 'right' ? 'direito' : '';
  const where = part ? `${part}${sideLabel ? ` ${part === 'coxa' || part === 'panturrilha' ? (injury.side === 'left' ? 'esquerda' : 'direita') : sideLabel}` : ''}` : '';
  const grade = Number(injury.grade) || 0;
  const severity = injury.severity || (grade >= 3 ? 'Grave' : grade === 2 ? 'Mediana' : 'Leve');
  const titleEl = $('#treatmentPlayerName');
  if (titleEl) titleEl.textContent = `${player.name}: ${String(injury.name || 'lesão').toLowerCase()}`;
  const kicker = $('#treatmentKicker');
  if (kicker) kicker.textContent = `BOLETIM DO DEPARTAMENTO MÉDICO${d.dateLabel ? ` · ${d.dateLabel}` : ''}`;
  const caseEl = $('#treatmentCase');
  if (caseEl) caseEl.textContent = caseTotal > 1 ? `Caso ${caseIndex} de ${caseTotal}` : '';

  const minute = injury.minute != null ? ` aos ${injury.minute}'` : '';
  const how = injury.matchHint ? `Teve ${esc(injury.matchHint)}${minute}.` : `Lesionou-se${minute}.`;
  const exam = `O exame confirmou <b>${esc(String(injury.name || 'a lesão').toLowerCase())}</b>${where ? ` no <b>${esc(where)}</b>` : ''}.`;
  const recoText =
    recommended === 'surgery'
      ? 'O médico recomenda <b>cirurgia</b>: volta antes e com menos risco de recaída.'
      : 'O médico recomenda <b>tratamento conservador</b>: a cirurgia não compensa o custo neste caso.';
  const playerEl = $('#treatmentPlayer');
  if (playerEl) {
    playerEl.innerHTML = `
      ${bodyMapSvg(injury.bodyPart, injury.side)}
      <div class="mb2-player-copy">
        <div class="mb2-player-line">
          ${player.pos ? `<span class="mb2-pos">${esc(player.pos)}</span>` : ''}
          <strong>${esc(player.name)}</strong>
          <small>${[player.age ? `${player.age} anos` : '', starter ? 'titular' : 'reserva', player.overall ? `OVR ${player.overall}` : ''].filter(Boolean).join(' · ')}</small>
        </div>
        <div class="mb2-chips"><span class="mb2-chip is-out">FORA</span><span class="mb2-chip is-grade g-${grade}">GRAU ${grade || '—'} · ${esc(String(severity).toUpperCase())}</span></div>
        <p>${how} ${exam} ${recoText}</p>
        ${substitute ? `<span class="mb2-sub">Substituto na escalação: ${esc(substitute.name)} (${esc(substitute.pos)}, ${substitute.overall})</span>` : ''}
      </div>`;
  }

  const c = options.conservative;
  const s = options.surgery;
  const best = (a, b, lowerIsBetter = true) => (a === b ? '' : (lowerIsBetter ? a < b : a > b) ? 'a' : 'b');
  const cell = (value, cls, on) => `<span class="mb2-cell ${cls}${on ? ' is-best' : ''}">${esc(value)}</span>`;
  const row = (label, a, b, which, ca = '', cb = '') =>
    `<div class="mb2-row"><span class="mb2-label">${esc(label)}</span>${cell(a, ca, which === 'a')}${cell(b, cb, which === 'b')}</div>`;
  const tone = (which, side) => (which === side ? 'is-good' : which ? 'is-bad' : '');
  const daysBest = best(c.days, s.days);
  const recBest = best(c.recurrenceDelta || 0, s.recurrenceDelta || 0);
  const gamesBest = best(gamesMissed.conservative, gamesMissed.surgery);
  const head = (label, key) => {
    const tag = recommended === key && !(key === 'surgery' && !canSurgery) ? '<em>RECOMENDADO</em>' : '';
    const off = key === 'surgery' && !canSurgery ? ' is-off' : '';
    const offTag = key === 'surgery' && !canSurgery ? '<em class="is-red">SEM SALDO</em>' : '';
    return `<span class="mb2-choice${off}${recommended === key ? ' is-reco' : ''}">${label}${tag}${offTag}</span>`;
  };
  const compare = $('#treatmentCompare');
  if (compare) {
    compare.innerHTML = `
      <div class="mb2-row is-head"><span class="mb2-label"></span>${head('CONSERVADOR', 'conservative')}${head('CIRURGIA', 'surgery')}</div>
      ${row('Custo', money(c.cost), money(s.cost), '', '', canSurgery ? '' : 'is-muted')}
      ${row('Volta aos treinos', `~${c.days} dias`, `~${s.days} dias`, daysBest, tone(daysBest, 'a'), tone(daysBest, 'b'))}
      ${row('Retorno previsto', returnDates.conservative, returnDates.surgery, daysBest, tone(daysBest, 'a'), tone(daysBest, 'b'))}
      ${row('Jogos que perde', `~${gamesMissed.conservative} jogo${gamesMissed.conservative === 1 ? '' : 's'}`, `~${gamesMissed.surgery} jogo${gamesMissed.surgery === 1 ? '' : 's'}`, gamesBest, tone(gamesBest, 'a'), tone(gamesBest, 'b'))}
      ${row('Risco de recaída', pct(c.recurrenceDelta), pct(s.recurrenceDelta), recBest, tone(recBest, 'a'), tone(recBest, 'b'))}`;
  }

  const cashEl = $('#treatmentCash');
  const afterC = cash - c.cost;
  if (cashEl) {
    if (cash < 0 || !canSurgery) {
      cashEl.className = 'mb2-cash is-alert';
      cashEl.innerHTML = `<b>CAIXA ${esc(money(cash))}</b><span>Cirurgia indisponível — faltam ${esc(money(Math.max(0, s.cost - cash)))}. O conservador é obrigatório e ${afterC < 0 ? `entra no cheque especial (caixa vai a ${esc(money(afterC))})` : `deixa o caixa em ${esc(money(afterC))}`}.</span>`;
    } else {
      cashEl.className = 'mb2-cash';
      cashEl.innerHTML = `<b>CAIXA ${esc(money(cash))}</b><span>Depois da cirurgia: ${esc(money(cash - s.cost))} · depois do conservador: ${esc(money(afterC))}${medLabel ? ` · ${esc(medLabel)}` : ''}</span>`;
    }
  }

  const consBtn = $('#treatmentConservative');
  const surgBtn = $('#treatmentSurgery');
  const finBtn = $('#treatmentFinance');
  if (consBtn) {
    consBtn.textContent = canSurgery ? `CONSERVADOR · ${money(c.cost)}` : `CONFIRMAR CONSERVADOR · ${money(c.cost)}`;
    consBtn.className = `mb2-btn ${canSurgery ? (recommended === 'conservative' ? 'is-primary' : 'is-sec') : 'is-primary'}`;
  }
  if (surgBtn) {
    surgBtn.textContent = `CIRURGIA · ${money(s.cost)}`;
    surgBtn.disabled = !canSurgery;
    surgBtn.classList.toggle('hidden', !canSurgery);
    surgBtn.className = `mb2-btn ${recommended === 'surgery' ? 'is-primary' : 'is-sec'}${canSurgery ? '' : ' hidden'}`;
    surgBtn.title = canSurgery ? '' : `Saldo insuficiente para cirurgia (${money(s.cost)})`;
  }
  if (finBtn) finBtn.classList.toggle('hidden', canSurgery);
}
