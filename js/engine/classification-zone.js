/** Zona de classificação na tabela (acesso / rebaixamento). */
export function classificationZone(division, index, total, serieCRelegationZone = 4) {
  if (division === 'A' && index >= total - 4) return 'relegation';
  if (division === 'B') {
    if (index < 4) return 'promotion';
    if (index >= total - 4) return 'relegation';
    return '';
  }
  if (division === 'C') {
    if (index < 4) return 'promotion';
    if (index >= total - serieCRelegationZone) return 'relegation';
    return '';
  }
  return '';
}
