import { teamCrestHtml } from '../../ui/team-crest.js';

/**
 * Mensagens v2: título com o fato, dados em blocos, uma frase humana e
 * (no leitor) a ação certa. Trabalha sobre as mensagens já salvas — usa
 * `meta` quando existe e, sem ele, organiza o texto em blocos.
 */
const esc = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const pick = (list, seed) => list[Math.abs(Number(seed) || 0) % list.length];
const seedOf = message => String(message?.id || message?.at || '').split('').reduce((t, ch) => t + ch.charCodeAt(0), 0);

const money = value => {
  const n = Math.round(Number(value) || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace('.', ',')} mi`;
  if (abs >= 1e3) return `${sign}R$ ${Math.round(abs / 1e3)} mil`;
  return `${sign}R$ ${abs}`;
};

function matchSides(message, userClub) {
  const meta = message?.meta || {};
  if (!meta.home || !meta.away) return null;
  const userHome = meta.home === userClub;
  const opponent = userHome ? meta.away : meta.home;
  const hg = Number(meta.homeGoals) || 0;
  const ag = Number(meta.awayGoals) || 0;
  const mine = userHome ? hg : ag;
  const theirs = userHome ? ag : hg;
  return { meta, userHome, opponent, hg, ag, mine, theirs, diff: mine - theirs };
}

/** Título dinâmico (o fato) — usado na lista e no leitor. */
export function messageDisplayTitle(message, { userClub } = {}) {
  if (message?.type === 'match-result') {
    const side = matchSides(message, userClub);
    if (side) {
      const { opponent, diff, userHome, mine, theirs } = side;
      const seed = seedOf(message);
      if (diff >= 3) return pick([`Goleada sobre o ${opponent}`, `Atropelo: ${mine} a ${theirs} no ${opponent}`], seed);
      if (diff > 0) return userHome ? pick([`Vitória sobre o ${opponent}`, `Três pontos contra o ${opponent}`], seed) : pick([`Vitória fora contra o ${opponent}`, `Triunfo na casa do ${opponent}`], seed);
      if (diff === 0) return mine === 0 ? `Empate sem gols com o ${opponent}` : pick([`Empate com o ${opponent}`, `Igualdade contra o ${opponent}`], seed);
      if (diff <= -3) return `Goleada sofrida para o ${opponent}`;
      return userHome ? pick([`Derrota em casa para o ${opponent}`, `Tropeço diante do ${opponent}`], seed) : `Derrota para o ${opponent}`;
    }
  }
  return message?.title || '';
}

function tile(label, value, tone = '', sub = '') {
  return `<div class="msg2-tile${tone ? ` is-${tone}` : ''}"><small>${esc(label)}</small><strong>${value}</strong>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
}

function matchResultHtml(message, userClub) {
  const side = matchSides(message, userClub);
  if (!side) return null;
  const { meta, hg, ag, diff, userHome, opponent } = side;
  const outcome = diff > 0 ? 'win' : diff < 0 ? 'loss' : 'draw';
  const crowd = Number(meta.attendance) || 0;
  const fill = meta.fillRate != null ? Math.round(Number(meta.fillRate) * 100) : null;
  const lines = String(message.body || '').split('\n');
  const netLine = lines.find(line => /l[ií]quido/i.test(line));
  const net = netLine ? (netLine.match(/l[ií]quido\s+(.+)$/i) || [])[1] : null;
  const tiles = [
    crowd ? tile('PÚBLICO', crowd.toLocaleString('pt-BR'), '', fill != null ? `${fill}% do estádio` : '') : '',
    userHome && meta.gateRevenue ? tile('BILHETERIA', esc(money(meta.gateRevenue)), 'gold') : '',
    userHome && net ? tile('LÍQUIDO', esc(net.trim()), String(net).includes('-') ? 'bad' : 'good', 'após custos') : '',
  ].filter(Boolean);
  const seed = seedOf(message);
  const phrase = outcome === 'win'
    ? pick([`${userHome ? 'Em casa' : 'Fora de casa'}, o time controlou o jogo e somou mais três pontos.`, `Boa resposta do elenco diante do ${opponent}.`, 'O vestiário sai confiante para a sequência.'], seed)
    : outcome === 'loss'
      ? pick([`Noite difícil contra o ${opponent}. Hora de ajustar para o próximo compromisso.`, 'O resultado pesa no ambiente; a próxima partida ganha importância.', `O ${opponent} foi mais eficiente nas chances que teve.`], seed)
      : pick(['Jogo equilibrado, ponto que mantém o time na briga.', `Nenhum dos dois conseguiu se impor diante do ${opponent}.`], seed);
  return `<div class="msg2-score" data-outcome="${outcome}">${teamCrestHtml(meta.home, { className: 'msg2-crest' })}<strong>${hg} — ${ag}</strong>${teamCrestHtml(meta.away, { className: 'msg2-crest' })}<span><b>${esc(meta.home)} × ${esc(meta.away)}</b><small>${esc([meta.competition, meta.roundLabel].filter(Boolean).join(' · '))}</small></span></div>
    ${tiles.length ? `<div class="msg2-tiles-row">${tiles.join('')}</div>` : ''}
    <p class="msg2-phrase">${esc(phrase)}</p>`;
}

/** Texto genérico em blocos: "Rótulo: valor" vira tile; "• item" vira lista; o resto, parágrafos. */
function blocksFromBody(body) {
  const lines = String(body || '').split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  const tiles = [];
  const bullets = [];
  const paragraphs = [];
  lines.forEach(line => {
    const bullet = line.match(/^[•\-–]\s*(.+)$/);
    if (bullet) { bullets.push(bullet[1]); return; }
    const kv = line.match(/^([A-Za-zÀ-ú][^:]{1,28}):\s*(.{1,40})$/);
    if (kv && !/[.!?]$/.test(kv[2])) { tiles.push([kv[1], kv[2]]); return; }
    paragraphs.push(line);
  });
  const [lead, ...rest] = paragraphs;
  return [
    lead ? `<p class="msg2-lead">${esc(lead)}</p>` : '',
    tiles.length ? `<div class="msg2-tiles-row">${tiles.slice(0, 6).map(([k, v]) => tile(k.toUpperCase(), esc(v), /[-−]\s*R\$|−/.test(v) ? 'bad' : /\+R\$/.test(v) ? 'good' : '')).join('')}</div>` : '',
    bullets.length ? `<ul class="msg2-list">${bullets.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '',
    rest.map(line => `<p class="msg2-text">${esc(line)}</p>`).join(''),
  ].join('');
}

/** Corpo v2 da mensagem para o leitor. */
export function messageCardHtml(message, { userClub } = {}) {
  if (!message) return '';
  if (message.type === 'match-result') {
    const html = matchResultHtml(message, userClub);
    if (html) return html;
  }
  return blocksFromBody(message.body);
}
