import { createSeasonSummaryFeature } from '../feature/season-summary/index.js';
import { createLayoutEditor } from './layout-editor.js';

const LAYOUT_KEY = 'brfut-season-summary-lab-layout-v1';

const GOAL_SAMPLES = {
  missed: {
    status: 'missed',
    label: 'Conquistar o acesso à Série C',
    feeling: 'Abaixo do combinado. A diretoria cobrará mudanças.',
    boardDelta: -17,
  },
  near: {
    status: 'near',
    label: 'Chegar às oitavas do mata-mata',
    feeling: 'Quase lá — a diretoria mantém o projeto, com ressalvas.',
    boardDelta: -3,
  },
  met: {
    status: 'met',
    label: 'Avançar da fase de grupos',
    feeling: 'Meta da temporada cumprida. A diretoria está satisfeita.',
    boardDelta: 4,
  },
  exceeded: {
    status: 'exceeded',
    label: 'Conquistar o acesso à Série C',
    feeling: 'A diretoria celebra: a meta foi superada.',
    boardDelta: 18,
  },
};

const $ = sel => document.querySelector(sel);

let toastTimer = 0;
let layoutEditor = null;

function showToast(text) {
  const existing = document.querySelector('.ssl-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'ssl-toast';
  el.textContent = text;
  document.body.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2600);
}

const formatBudget = value =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const seasonSummary = createSeasonSummaryFeature({
  $,
  clubCrestInitials: name => String(name || 'CL').slice(0, 2).toUpperCase(),
  clubSeasonLeaders: () => ({}),
  clubSeasonRatingSummary: () => null,
  formatMatchRating: value => (Number(value) ? Number(value).toFixed(1) : '—'),
  onStartNextSeason: () => showToast('[Lab] Avançar temporada — integração virá após aprovação.'),
  onCloseSeasonSummary: () => {
    if (layoutEditor?.isEditMode()) layoutEditor.setEditMode(false);
    seasonSummary.close();
  },
});

function sampleLeaders() {
  return {
    scorers: [{ name: 'Artilheiro FC', club: 'Clube A', goals: 19 }],
    assistants: [{ name: 'Garçom FC', club: 'Clube B', assists: 11 }],
  };
}

function openPanel() {
  const status = $('#sslGoalStatus')?.value || 'met';
  const leaders = sampleLeaders();

  seasonSummary.open({
    preview: true,
    userClub: 'Vinaz Athletic',
    careerSeason: 2026,
    userDivision: 'D',
    userLine: 'Permanecerá na Série D em 2027. (dados fictícios do lab)',
    userStatus: 'neutral',
    leadText: 'Lab de layout — dados fictícios para organizar o painel de fim de temporada.',
    champions: {
      A: 'Santos',
      B: 'Athletic',
      C: 'Paysandu',
      D: 'Vinaz Athletic',
      CUP: 'Santos',
      RECOPA: 'Santos',
    },
    recopaSubtitle: 'Título unificado (Brasileirão + Copa)',
    championEstaduais: [
      { key: 'EST:MT', uf: 'MT', label: 'Mato-Grossense', clubName: 'Vinaz Athletic' },
      { key: 'EST:SP', uf: 'SP', label: 'Paulista', clubName: 'Corinthians' },
      { key: 'EST:RJ', uf: 'RJ', label: 'Carioca', clubName: 'Flamengo' },
    ],
    leadersByDivision: {
      A: leaders,
      B: leaders,
      C: leaders,
      D: leaders,
      CUP: leaders,
    },
    movements: [
      { title: 'Acesso à Série C', clubs: ['Clube Norte', 'Clube Sul'], type: 'promote' },
      { title: 'Rebaixamento Série D', clubs: ['Desportivo X'], type: 'relegate' },
      { title: 'Permanece na Série D', clubs: ['Vinaz Athletic'], type: 'relegate' },
    ],
    seasonRewards: {
      total: 420000,
      budgetAfter: 1280000,
      lines: [
        { label: 'Colocação Série D', amount: 180000 },
        { label: 'Copa do Brasil', amount: 90000 },
        { label: 'Estadual', amount: 150000 },
      ],
    },
    formatBudget,
    seasonGoalResult: { ...GOAL_SAMPLES[status] },
    seasonObjectivesResult: {
      feeling: 'Objetivos extras avaliados pela diretoria.',
      boardDelta: 2,
      items: [
        { label: 'Base sub-20 campeã estadual', status: 'met' },
        { label: 'Público médio acima de 2.500', status: 'near' },
        { label: 'Saldo de gols positivo', status: 'missed' },
      ],
    },
  });

  tagEditableBlocks();
  setupLayoutEditor();
}

function tagEditableBlocks() {
  const card = document.querySelector('#seasonTransitionModal .season-summary-modal');
  if (!card) return;

  const blocks = [
    { sel: 'label', id: 'label' },
    { sel: '#seasonSummaryTitle', id: 'title' },
    { sel: '#seasonTransitionLead', id: 'lead' },
    { sel: '#seasonTransitionSummary', id: 'user-summary' },
    { sel: '#seasonGoalSection', id: 'goal-section' },
    { sel: '#seasonObjectivesSection', id: 'objectives-section' },
    { sel: '.season-champions-section', id: 'champions-section' },
    { sel: '#seasonLeaders', id: 'leaders-section', parent: true },
    { sel: '#seasonRewardsSection', id: 'rewards-section' },
    { sel: '#seasonMovements', id: 'movements-section', parent: true },
    { sel: '.season-summary-actions', id: 'actions' },
  ];

  for (const block of blocks) {
    const el = card.querySelector(block.sel);
    const target = block.parent ? el?.closest('.season-summary-section') : el;
    if (!target) continue;
    target.dataset.labEditable = 'true';
    target.dataset.labId = block.id;
  }

  card.querySelectorAll('[data-lab-locked]').forEach(node => node.removeAttribute('data-lab-locked'));
  card.querySelector('.season-champions-layout')?.setAttribute('data-lab-locked', 'true');
  card.querySelector('.season-leaders-grid')?.setAttribute('data-lab-locked', 'true');
  card.querySelector('.season-movements-grid')?.setAttribute('data-lab-locked', 'true');
  card.querySelector('.season-rewards')?.setAttribute('data-lab-locked', 'true');
  card.querySelector('.season-goal-result')?.setAttribute('data-lab-locked', 'true');
  card.querySelector('.season-objectives-result')?.setAttribute('data-lab-locked', 'true');
}

function setupLayoutEditor() {
  const card = document.querySelector('#seasonTransitionModal .season-summary-modal');
  if (!card) return;

  if (!layoutEditor) {
    layoutEditor = createLayoutEditor({
      stage: card,
      storageKey: LAYOUT_KEY,
      editableSelector: '[data-lab-editable]',
      editToggle: $('#sslEditToggle'),
      resetButton: $('#sslResetLayout'),
      copyButton: $('#sslCopyLayout'),
      editHint: $('#sslEditHint'),
      stageEditClass: 'ssl-layout-stage--edit',
      showToast,
    });
  } else {
    layoutEditor.applyLayout(JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'));
  }
}

$('#sslOpenBtn')?.addEventListener('click', openPanel);
$('#sslGoalStatus')?.addEventListener('change', () => {
  if (!$('#seasonTransitionModal')?.classList.contains('hidden')) openPanel();
});

openPanel();
