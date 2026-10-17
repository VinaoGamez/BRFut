async function hasLocalCareer() {
  try {
    const { hasPersistedCareer } = await import('./core/career-activate.js');
    return hasPersistedCareer();
  } catch {
    return false;
  }
}
async function recoverLocalCareer() {
  try {
    const result = repairCareerSlotsFromLocalStorage();
    if (!result.recovered) return false;
    const saves = listLocalCareerSaves();
    if (saves.length) {
      showSaveRecoveryAlert(saves);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}