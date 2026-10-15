/**
 * Zona de classificação na tabela (acesso / avanço / rebaixamento).
 *
 * A Série C passou a ter três estados na fase 1, e não dois: os 8 primeiros
 * **avançam** para os grupos, mas só os vencedores de grupo sobem de divisão.
 * Misturar "avançou" com "subiu" é o que faz a tela mente — o clube pode estar
 * na zona verde da fase 1 e não.accessar a Série B ao fim da temporada.
 *
 * - `promotion`   acesso direto (Série A e B; na C,Keeper só depois da final)
 * - `qualified`   avançou para a segunda fase, mas ainda não subiu
 * - `relegation`  zona de rebaixamento
 */
import { SERIE_C_QUALIFIED } from './serie-c-format.js';

export function classificationZone(division, index, total, serieCRelegationZone = 4, { phase = 1 } = {}) {
  if (division === 'A' && index >= total - 4) return 'relegation';
  if (division === 'B') {
    if (index < 4) return 'promotion';
    if (index >= total - 4) return 'relegation';
    return '';
  }
  if (division === 'C') {
    const zona = Number(serieCRelegationZone) || 4;
    if (index >= total - zona) return 'relegation';
    // Na fase 1 ninguém sobe direto: os 8 primeiros vão para os grupos. Só os
    // vencedores de grupo sobem, e isso é decidido no fim da temporada.
    const avanca = Math.min(SERIE_C_QUALIFIED, total);
    if (Number(phase) === 1 && index < avanca) return 'qualified';
    if (Number(phase) !== 1 && index < 4) return 'promotion';
    return '';
  }
  return '';
}
