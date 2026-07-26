/**
 * Textos oficiais (espelho CBF 2026+) exibidos no botão REGRAS da seção Campeonatos.
 */

import {
  SERIE_D_CLUBS,
  SERIE_D_PROMOTIONS,
  SERIE_C_RELEGATION_TO_D,
  serieCClubsForSeason,
  serieCRelegationSlots,
} from './serie-c-calendar.js';
import { serieDGroupFormationSummary } from './serie-d-format.js';
import { SERIE_D_STATE_SLOTS } from './serie-d-formation.js';
import { ufLabel } from './state-league-format.js';
import { STATE_LEAGUE_FIRST_SERIE_D_SEASON } from './state-league-format.js';

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const section = (heading, items) => ({ heading, items: items.filter(Boolean) });

/** @param {number|string} season */
export function buildCompetitionRules(competitionId, season) {
  const year = Number(season) || 2026;
  const id = String(competitionId || 'A').toUpperCase();

  if (id.startsWith('EST:')) {
    const parts = id.split(':');
    const uf = parts[1] || 'SP';
    const tier = Number(parts[2]) || 1;
    const paulista = uf === 'SP';
    return {
      kicker: `ESTADUAL · ${uf} · ${year}`,
      title: `Regulamento — ${ufLabel(uf)}${tier > 1 ? ` · Divisão ${tier}` : ''}`,
      sections: paulista
        ? [
            section('Formato', [
              'Paulista: 2 grupos de 9 clubes (turno único intra-grupo).',
              'Os 4 primeiros de cada grupo avançam às quartas de final.',
              'Mata-mata: quartas, semifinais e final em jogo único (1ºA×4ºB, 2ºA×3ºB, etc.).',
              '4 divisões visíveis por temporada.',
            ]),
            section('Acesso e rebaixamento', [
              'Divisões de 10 clubes: 4 semifinalistas sobem; 4 piores descem.',
              'Divisão 1 (Paulista): somente rebaixamento — 2 piores de cada grupo (4 clubes → Divisão 2).',
              'Divisão 1 recebe os 4 semifinalistas da Divisão 2.',
              'Última divisão visível: 4 melhores sobem; elenco = 4 rebaixados da divisão acima + sorteio até 10 clubes.',
            ]),
            section('Calendário', [
              'Janela CBF: 11/jan – 8/mar (11 datas).',
              '8 rodadas de grupos + quartas + semi + final.',
              'Jogos aos sábados (16h / 18h30), datas travadas no save.',
            ]),
            section('Classificação', [
              'Fase de grupos: vitória 3, empate 1.',
              'Desempate: pontos, vitórias, saldo de gols, nome do clube.',
            ]),
            section('Premiação e Série D', [
              'Campeão e vice ficam registrados no save estadual.',
              year >= STATE_LEAGUE_FIRST_SERIE_D_SEASON
                ? `A partir de ${STATE_LEAGUE_FIRST_SERIE_D_SEASON}, o desempenho estadual alimenta as vagas RNF da Série D (critério CBF).`
                : 'Em 2026 (estreia), o estadual não altera a formação da Série D.',
            ]),
            section('Copa do Brasil', [
              'A federação indica representante(s) via estadual para vagas da Copa.',
              'Se o titular da vaga já possui vaga segura (ex.: Série A, 5ª fase), a vaga passa ao próximo melhor colocado no estadual.',
              'Ordem de repasse: campeão, vice, semifinalistas, melhor campanha na fase de grupos.',
            ]),
          ]
        : [
            section('Formato', [
              'Pontos corridos (turno único) + semifinais + final.',
              '4 divisões visíveis por temporada.',
            ]),
            section('Acesso e rebaixamento', [
              'Divisões de 10 clubes: 4 semifinalistas sobem; 4 piores descem.',
              'Divisão 1: somente rebaixamento — descem os 4 piores (sem acesso de divisão superior).',
              'Divisão 1 recebe os 4 semifinalistas da Divisão 2.',
              'Última divisão visível: 4 melhores sobem; elenco = 4 rebaixados da divisão acima + sorteio até 10 clubes.',
            ]),
            section('Calendário', [
              'Janela CBF: 11/jan – 8/mar (11 datas).',
              'Com 10 clubes: 9 rodadas de pontos corridos + semi + final.',
              'Jogos aos sábados (16h / 18h30), datas travadas no save.',
            ]),
            section('Classificação', [
              'Fase de pontos corridos: vitória 3, empate 1.',
              'Desempate: pontos, vitórias, saldo de gols, nome do clube.',
            ]),
            section('Premiação e Série D', [
              'Campeão e vice ficam registrados no save estadual.',
              year >= STATE_LEAGUE_FIRST_SERIE_D_SEASON
                ? `A partir de ${STATE_LEAGUE_FIRST_SERIE_D_SEASON}, o desempenho estadual alimenta as vagas RNF da Série D (critério CBF).`
                : 'Em 2026 (estreia), o estadual não altera a formação da Série D.',
            ]),
            section('Copa do Brasil', [
              'A federação indica representante(s) via estadual para vagas da Copa.',
              'Se o titular da vaga já possui vaga segura (ex.: Série A, 5ª fase), a vaga passa ao próximo melhor colocado no estadual.',
              'Ordem de repasse: campeão, vice, semifinalistas, melhor campanha na fase de pontos corridos.',
            ]),
          ],
    };
  }

  if (id === 'EST' || id === 'STATE') {
    return buildCompetitionRules('EST:SP', season);
  }

  if (id === 'CUP') {
    return {
      kicker: `COPA DO BRASIL · ${year}`,
      title: 'Regulamento da Copa do Brasil',
      sections: [
        section('Formato', [
          '126 clubes em 9 fases, com sorteios progressivos.',
          '1ª à 4ª fase em jogo único; da 5ª fase à semifinal em ida e volta; final em jogo único.',
        ]),
        section('Entradas', [
          'Série A entra apenas na 5ª fase (20 clubes).',
          'Demais divisões e convidados entram nas fases iniciais conforme o chaveamento.',
        ]),
        section('Classificação', [
          'No mata-mata, avança quem vencer o confronto (agregado quando houver ida e volta).',
          'Empate no agregado: decisão nos pênaltis.',
        ]),
      ],
    };
  }

  if (id === 'RECOPA' || id === 'RECOPA_NATIONAL') {
    return {
      kicker: `RECOPA NACIONAL · ${year}`,
      title: 'Recopa Nacional do Brasil',
      sections: [
        section('Formato', [
          'Supercopa entre o campeão do Campeonato Brasileiro (Série A) e o campeão da Copa do Brasil.',
          'Jogo único — empate vai aos pênaltis.',
        ]),
        section('Participantes', [
          'Campeão do Brasileirão da temporada anterior × campeão da Copa do Brasil da temporada anterior.',
          'Se o mesmo clube vencer os dois torneios, a Recopa não é disputada.',
        ]),
        section('Calendário', [
          'Janela CBF: 25/jan – 15/fev.',
          'Data nominal: domingo 8/fev (18h), grade semanal BR.',
        ]),
        section('Premiação', [
          'Vencedor registrado como campeão da Recopa Nacional no save.',
        ]),
      ],
    };
  }

  if (id === 'D') {
    return {
      kicker: `BRASILEIRÃO SÉRIE D · ${year}`,
      title: 'Regulamento da Série D',
      sections: [
        section('Formato', [
          `${SERIE_D_CLUBS} clubes em 16 grupos de 6.`,
          'Fase de grupos: turno e returno dentro do grupo (10 rodadas).',
          'Os 4 primeiros de cada grupo avançam ao mata-mata.',
        ]),
        section('Formação do elenco (CBF)', [
          `${SERIE_D_CLUBS} vagas totais, definidas por quatro critérios:`,
          `${SERIE_C_RELEGATION_TO_D} rebaixados da Série C do ano anterior.`,
          `${SERIE_D_STATE_SLOTS} vagas estaduais distribuídas às 27 federações (RNF).`,
          'Permanência: clubes que alcançaram a 2ª fase na edição anterior.',
          'Complemento: melhores colocados no Ranking Nacional de Clubes sem divisão nacional (RNC).',
        ]),
        section('Formação dos grupos (CBF)', [
          ...serieDGroupFormationSummary(),
          'Mata-mata: A1×A2, A3×A4, … (1º×4º, 2º×3º entre grupos pareados).',
        ]),
        section('Mata-mata', [
          'Confrontos em ida e volta até a final.',
          'Nas quartas, os 4 vencedores já garantem acesso; há ainda semifinal e repescagem pelos 2 acessos restantes.',
        ]),
        section('Acesso', [
          `${SERIE_D_PROMOTIONS} clubes sobem para a Série C na temporada seguinte.`,
          'Não há rebaixamento a partir da Série D.',
        ]),
      ],
    };
  }

  if (id === 'C') {
    const clubs = serieCClubsForSeason(year);
    const relegated = serieCRelegationSlots();
    const nextClubs = serieCClubsForSeason(year + 1);
    const expansionNote =
      clubs < 28
        ? `Transição CBF: esta temporada tem ${clubs} clubes; na próxima a Série C passa a ${nextClubs} (${relegated} rebaixados à D e ${SERIE_D_PROMOTIONS} acessos da Série D).`
        : `Formato estável CBF a partir de 2028: ${clubs} clubes, ${relegated} rebaixados à Série D e ${SERIE_D_PROMOTIONS} acessos da Série D.`;

    return {
      kicker: `BRASILEIRÃO SÉRIE C · ${year}`,
      title: 'Regulamento da Série C',
      sections: [
        section('Formato', [
          `${clubs} clubes em pontos corridos (turno e returno).`,
          expansionNote,
        ]),
        section('Acesso à Série B', [
          'G4: os 4 primeiros conquistam o acesso à Série B.',
        ]),
        section('Rebaixamento à Série D', [
          `Z${relegated}: os ${relegated} últimos são rebaixados à Série D.`,
          `A Série D promove ${SERIE_D_PROMOTIONS} clubes para a Série C.`,
        ]),
      ],
    };
  }

  if (id === 'B') {
    return {
      kicker: `BRASILEIRÃO SÉRIE B · ${year}`,
      title: 'Regulamento da Série B',
      sections: [
        section('Formato', [
          '20 clubes em pontos corridos (turno e returno · 38 rodadas).',
        ]),
        section('Acesso à Série A', [
          '1º e 2º sobem direto.',
          '3º ao 6º disputam playoffs de acesso (mais 2 vagas).',
          'Total: 4 acessos à Série A.',
        ]),
        section('Rebaixamento à Série C', [
          'Z4: os 4 últimos são rebaixados à Série C.',
        ]),
      ],
    };
  }

  // Série A (default)
  return {
    kicker: `BRASILEIRÃO SÉRIE A · ${year}`,
    title: 'Regulamento da Série A',
    sections: [
      section('Formato', [
        '20 clubes em pontos corridos (turno e returno · 38 rodadas).',
      ]),
      section('Título', [
        'O 1º colocado é o campeão brasileiro da Série A.',
      ]),
      section('Rebaixamento à Série B', [
        'Z4: os 4 últimos são rebaixados à Série B.',
      ]),
    ],
  };
}

export function competitionRulesHtml(competitionId, season) {
  const rules = buildCompetitionRules(competitionId, season);
  const sections = rules.sections
    .map(
      block =>
        `<section class="competition-rules-section"><h3>${escapeHtml(block.heading)}</h3><ul>${block.items
          .map(item => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul></section>`,
    )
    .join('');
  return {
    kicker: rules.kicker,
    title: rules.title,
    bodyHtml: sections,
  };
}
