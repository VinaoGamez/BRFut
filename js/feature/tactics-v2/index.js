/**
 * Táticas v2 (canvas "Táticas v2"): estilos de jogo em cartões, formações
 * com desenho, confronto por setor, leitura do auxiliar, ver adversário e
 * abas no celular. Camada de interface sobre a tática existente: os estilos
 * só preenchem os mesmos 4 controles (mentalidade, construção, pressão,
 * linha), e nada muda no motor de jogo.
 */
import { positionLine } from '../shared/player-cells.js';

export const PLAY_STYLES = Object.freeze([
  { id: 'balanced', name: 'Equilibrado', hint: 'Sem riscos, se adapta ao jogo', icon: 'M12 3v18M5 7h14M3 13l2-6 2 6a2 2 0 0 1-4 0zM17 13l2-6 2 6a2 2 0 0 1-4 0z', values: { mentality: 50, possession: 50, press: 50, offsideLine: 50 } },
  { id: 'possession', name: 'Posse de bola', hint: 'Toques curtos, cansa menos', icon: 'M4 12h4l3-6 3 12 3-6h3', values: { mentality: 60, possession: 80, press: 55, offsideLine: 60 } },
  { id: 'counter', name: 'Contra-ataque', hint: 'Espera e sai rápido', icon: 'M3 12h13M12 6l6 6-6 6M21 5v14', values: { mentality: 40, possession: 20, press: 40, offsideLine: 35 } },
  { id: 'press', name: 'Pressão alta', hint: 'Rouba na frente, gasta energia', icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', values: { mentality: 70, possession: 60, press: 85, offsideLine: 75 } },
  { id: 'direct', name: 'Jogo direto', hint: 'Bola longa no centroavante', icon: 'M3 18c4-10 14-10 18 0M18 15l3 3-4 1', values: { mentality: 60, possession: 30, press: 50, offsideLine: 50 } },
  { id: 'park', name: 'Retranca', hint: 'Fecha o gol, aposta no 0×0', icon: 'M4 20h16M6 20V8l6-4 6 4v12M10 20v-5h4v5', values: { mentality: 15, possession: 30, press: 30, offsideLine: 25 } },
]);

const SLIDERS = { mentality: '#mentalitySlider', possession: '#possessionSlider', press: '#pressSlider', offsideLine: '#offsideLineSlider' };
const LINES = [
  { id: 'atk', label: 'Ataque', roles: ['PE', 'PD', 'ATA', 'MEI'] },
  { id: 'mid', label: 'Meio', roles: ['VOL', 'MC', 'MEI'] },
  { id: 'def', label: 'Defesa', roles: ['GOL', 'ZAG', 'LAT'] },
];
const MOBILE_TABS = [['campo', 'Campo'], ['estilo', 'Estilo'], ['confronto', 'Confronto']];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const avg = list => (list.length ? list.reduce((total, value) => total + value, 0) / list.length : 0);

/** Média de OVR por setor: titulares no papel da formação. */
export function lineStrengths(players = [], roles = []) {
  return Object.fromEntries(LINES.map(line => {
    const values = players
      .map((player, index) => ({ player, role: roles[index] || player?.pos }))
      .filter(({ player, role }) => player && line.roles.includes(role))
      .map(({ player }) => Number(player.overall) || 0);
    return [line.id, Math.round(avg(values))];
  }));
}

/** XI provável do adversário: melhores por posição para os papéis da formação dele. */
export function probableXI(roster = [], roles = []) {
  const pool = [...roster].filter(Boolean).sort((a, b) => (b.overall || 0) - (a.overall || 0));
  const used = new Set();
  return roles.map(role => {
    const pick = pool.find(player => !used.has(player) && player.pos === role)
      || pool.find(player => !used.has(player) && positionLine(player.pos) === positionLine(role))
      || pool.find(player => !used.has(player));
    if (pick) used.add(pick);
    return pick || null;
  });
}

/** Leitura do auxiliar: até 5 frases, alertas primeiro. */
export function assistantReading({ starters = [], roles = [], mine = {}, theirs = {}, values = {}, blocked = () => false }) {
  const alerts = [];
  const strengths = [];
  starters.forEach((player, index) => {
    if (!player) return;
    if (blocked(player)) alerts.push({ tone: 'danger', text: `${player.name} não pode jogar: troque na escalação.` });
  });
  starters
    .filter(player => player && Number(player.fatigue) < 70)
    .sort((a, b) => a.fatigue - b.fatigue)
    .slice(0, 2)
    .forEach(player => alerts.push({ tone: 'warn', text: `${player.name} com ${Math.round(player.fatigue)}% de condição: risco de lesão.` }));
  const improvised = starters.filter((player, index) => player && roles[index] && positionLine(player.pos) !== positionLine(roles[index]));
  if (improvised.length) {
    alerts.push({ tone: 'warn', text: `${improvised.length === 1 ? `${improvised[0].name} improvisado` : `${improvised.length} jogadores improvisados`} fora do setor de origem.` });
  }
  LINES.forEach(line => {
    const me = mine[line.id] || 0;
    const op = theirs[line.id] || 0;
    if (!me || !op) return;
    if (me - op >= 3) strengths.push({ tone: 'ok', text: `${line.label} superior ao do adversário (${me} × ${op}).` });
    else if (op - me >= 3) alerts.push({ tone: 'warn', text: `${line.label} adversário mais forte (${op} × ${me}).` });
  });
  const avgFatigue = avg(starters.filter(Boolean).map(player => Number(player.fatigue) || 0));
  if (values.press > 65 && avgFatigue < 85) alerts.push({ tone: 'warn', text: 'Pressão alta com titulares desgastados: o time cansa mais rápido.' });
  if (values.offsideLine > 65 && (theirs.atk || 0) > (mine.def || 0)) alerts.push({ tone: 'danger', text: 'Linha alta contra ataque forte: cuidado com bolas nas costas.' });
  if (values.possession > 65 && (mine.mid || 0) >= (theirs.mid || 0)) strengths.push({ tone: 'ok', text: 'Meio-campo sustenta bem a posse de bola.' });
  if (values.possession < 35 && (mine.atk || 0) >= (theirs.def || 0)) strengths.push({ tone: 'ok', text: 'Ataque rápido o bastante para o contra-ataque.' });
  if (!alerts.length) strengths.unshift({ tone: 'ok', text: 'Escalação sem alertas: tudo pronto para o jogo.' });
  return [...alerts, ...strengths].slice(0, 5);
}

export function createTacticsV2({ $, getFormations, getFormationRoles, getFormation, getSquad, getTacticalValues, getOpponent, playerStarterBlocked }) {
  let arranged = false;
  let ghostsOn = false;
  let tab = 'campo';

  const view = () => document.getElementById('tactics');

  const formationThumb = name => {
    const points = getFormations()?.[name] || [];
    const dots = points
      .map(([x, y]) => `<circle cx="${(x / 100 * 34).toFixed(1)}" cy="${(y / 100 * 24).toFixed(1)}" r="1.7"/>`)
      .join('');
    return `<svg class="tac-form-thumb" viewBox="0 0 34 24" aria-hidden="true"><rect x=".5" y=".5" width="33" height="23"/>${dots}</svg>`;
  };

  const decorateFormations = () => {
    document.querySelectorAll('#formations button').forEach(button => {
      if (button.querySelector('.tac-form-thumb')) return;
      button.insertAdjacentHTML('afterbegin', formationThumb(button.textContent.trim()));
    });
  };

  const arrange = () => {
    const root = view();
    const board = root?.querySelector('.tactics');
    if (!root || !board || arranged) return;
    arranged = true;
    board.classList.add('tac-v2');
    const pitch = board.querySelector(':scope > .pitch');
    const controls = board.querySelector(':scope > .card.controls');
    const roster = board.querySelector(':scope > .tactic-roster');

    const tabs = document.createElement('div');
    tabs.className = 'tac-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = MOBILE_TABS.map(([id, label]) => `<button type="button" role="tab" data-tac-tab="${id}">${label}</button>`).join('');
    board.before(tabs);

    // Esquerda: estilos de jogo antes da formação e do ajuste fino.
    if (controls) {
      controls.classList.add('tac-left');
      const styles = document.createElement('section');
      styles.className = 'tac-styles';
      styles.innerHTML = `<label>ESTILO DE JOGO</label><div class="tac-style-grid">${PLAY_STYLES.map(style => `<button type="button" class="tac-style" data-tac-style="${style.id}"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${style.icon}"/></svg><strong>${style.name}</strong></span><small>${style.hint}</small></button>`).join('')}</div><p class="tac-style-custom" hidden>Ajuste personalizado</p>`;
      controls.prepend(styles);
      const formationLabel = [...controls.querySelectorAll(':scope > label')].find(label => /FORMA/.test(label.textContent));
      const sliders = controls.querySelectorAll(':scope > .tactic-slider');
      if (sliders.length) {
        const fine = document.createElement('label');
        fine.className = 'tac-fine-label';
        fine.textContent = 'AJUSTE FINO';
        sliders[0].before(fine);
      }
      formationLabel?.classList.add('tac-formation-label');
    }

    // Centro: barra de ferramentas + campo.
    const center = document.createElement('div');
    center.className = 'tac-center';
    const toolbar = document.createElement('div');
    toolbar.className = 'tac-toolbar';
    toolbar.innerHTML = '<button type="button" class="tac-ghost-toggle" aria-pressed="false">Ver adversário</button><span class="tac-toolbar-gap"></span>';
    const suggestion = controls?.querySelector('.tactic-suggestion-wrap');
    if (suggestion) toolbar.append(suggestion);
    pitch?.before(center);
    center.append(toolbar);
    if (pitch) {
      center.append(pitch);
      const ghosts = document.createElement('div');
      ghosts.className = 'tac-ghosts';
      ghosts.setAttribute('aria-hidden', 'true');
      pitch.append(ghosts);
      const legend = document.createElement('div');
      legend.className = 'tac-fit-legend';
      legend.innerHTML = '<span class="is-natural">posição natural</span><span class="is-adapted">adaptado</span><span class="is-improvised">improvisado</span>';
      pitch.append(legend);
    }

    // Direita: confronto, leitura do auxiliar e banco.
    const right = document.createElement('div');
    right.className = 'tac-right';
    right.innerHTML = '<section class="card tac-duel" aria-label="Confronto"></section><section class="card tac-assistant" aria-label="Leitura do auxiliar"><label>LEITURA DO AUXILIAR</label><div class="tac-assistant-list"></div></section>';
    roster?.before(right);
    if (roster) right.append(roster);

    tabs.addEventListener('click', event => {
      const button = event.target.closest('[data-tac-tab]');
      if (button) setTab(button.dataset.tacTab);
    });
    board.addEventListener('click', event => {
      const styleButton = event.target.closest('[data-tac-style]');
      if (styleButton) applyStyle(styleButton.dataset.tacStyle);
      if (event.target.closest('.tac-ghost-toggle')) {
        ghostsOn = !ghostsOn;
        refresh();
      }
    });
    setTab(tab);
  };

  const setTab = next => {
    tab = MOBILE_TABS.some(([id]) => id === next) ? next : 'campo';
    const root = view();
    root?.querySelector('.tactics')?.setAttribute('data-tac-tab', tab);
    root?.querySelectorAll('[data-tac-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tacTab === tab)));
  };

  const applyStyle = id => {
    const style = PLAY_STYLES.find(item => item.id === id);
    if (!style) return;
    Object.entries(style.values).forEach(([key, value]) => {
      const slider = $(SLIDERS[key]);
      if (!slider) return;
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    refresh();
  };

  const currentStyleId = values => PLAY_STYLES.find(style => Object.entries(style.values).every(([key, value]) => Number(values[key]) === value))?.id || null;

  const renderDuel = (mine, theirs, opponent) => {
    const card = view()?.querySelector('.tac-duel');
    if (!card) return;
    const name = opponent?.name || 'Adversário';
    const formation = opponent?.formation || '';
    card.innerHTML = `<label>CONFRONTO <em>vs ${esc(name)}</em></label>${LINES.map(line => {
      const me = mine[line.id] || 0;
      const op = theirs[line.id] || 0;
      const meTone = me >= op ? 'up' : 'down';
      const opTone = op > me ? 'up' : 'down';
      return `<div class="tac-duel-row"><b class="is-${meTone}">${me || '—'}</b><span class="tac-duel-bar is-me"><i style="width:${Math.min(100, me)}%"></i></span><small>${line.label}</small><span class="tac-duel-bar is-op"><i style="width:${Math.min(100, op)}%"></i></span><b class="is-op-${opTone}">${op || '—'}</b></div>`;
    }).join('')}${formation ? `<p>Adversário deve jogar no <strong>${esc(formation)}</strong>.</p>` : ''}`;
  };

  const renderAssistant = items => {
    const list = view()?.querySelector('.tac-assistant-list');
    if (!list) return;
    list.innerHTML = items.map(item => `<p class="tac-tip is-${item.tone}"><i aria-hidden="true">${item.tone === 'ok' ? '✓' : '!'}</i><span>${esc(item.text)}</span></p>`).join('');
  };

  const renderGhosts = opponent => {
    const pitch = view()?.querySelector('.tactics .pitch');
    const layer = pitch?.querySelector('.tac-ghosts');
    const toggle = view()?.querySelector('.tac-ghost-toggle');
    toggle?.setAttribute('aria-pressed', String(ghostsOn));
    pitch?.classList.toggle('show-ghosts', ghostsOn);
    if (!layer) return;
    const points = (opponent?.formation && getFormations()?.[opponent.formation]) || [];
    layer.innerHTML = ghostsOn
      ? points.map(([x, y]) => `<i style="left:${100 - x}%;top:${Math.max(6, 100 - y)}%"></i>`).join('')
      : '';
  };

  const refresh = () => {
    try {
      arrange();
      decorateFormations();
      const values = getTacticalValues?.() || {};
      const active = currentStyleId(values);
      view()?.querySelectorAll('[data-tac-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tacStyle === active)));
      const custom = view()?.querySelector('.tac-style-custom');
      if (custom) custom.hidden = !!active;

      const formation = getFormation();
      const roles = getFormationRoles?.()?.[formation] || [];
      const starters = (getSquad?.() || []).slice(0, 11);
      const mine = lineStrengths(starters, roles);
      const opponent = getOpponent?.() || null;
      const oppRoles = (opponent?.formation && getFormationRoles?.()?.[opponent.formation]) || [];
      const theirs = opponent?.roster?.length ? lineStrengths(probableXI(opponent.roster, oppRoles), oppRoles) : {};
      renderDuel(mine, theirs, opponent);
      renderAssistant(assistantReading({ starters, roles, mine, theirs, values, blocked: player => !!playerStarterBlocked?.(player) }));
      renderGhosts(opponent);
    } catch (error) {
      console.warn('[brfut] Táticas v2', error);
    }
  };

  return { refresh, setTab };
}
