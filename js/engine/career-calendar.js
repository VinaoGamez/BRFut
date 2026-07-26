/**
 * Calendário da carreira — data corrente, avanço por dia e batches de simulação.
 */

export function createCareerCalendar({ initialDate = null, dateHolder = null } = {}) {
  let careerCalendarDate = initialDate ? new Date(initialDate) : new Date();
  careerCalendarDate.setHours(12, 0, 0, 0);
  if (dateHolder) dateHolder.date = careerCalendarDate;

  let calendarBatchDepth = 0;
  /** @type {() => void} */
  let onCareerCalendarAdvanced = () => {};

  const syncHolder = () => {
    if (dateHolder) dateHolder.date = careerCalendarDate;
  };

  const advanceCareerCalendarTo = date => {
    if (!date) return;
    careerCalendarDate = new Date(date);
    careerCalendarDate.setHours(12, 0, 0, 0);
    syncHolder();
    onCareerCalendarAdvanced();
  };

  const setDate = date => {
    if (!date) return;
    careerCalendarDate = new Date(date);
    careerCalendarDate.setHours(12, 0, 0, 0);
    syncHolder();
  };

  const beginCalendarBatch = () => {
    calendarBatchDepth += 1;
  };

  const endCalendarBatch = () => {
    calendarBatchDepth = Math.max(0, calendarBatchDepth - 1);
  };

  const isCalendarBatch = () => calendarBatchDepth > 0;

  const sameCalendarDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

  const setOnAdvanced = handler => {
    onCareerCalendarAdvanced = typeof handler === 'function' ? handler : () => {};
  };

  return {
    get date() {
      return careerCalendarDate;
    },
    set date(value) {
      if (!value) return;
      careerCalendarDate = new Date(value);
      careerCalendarDate.setHours(12, 0, 0, 0);
      syncHolder();
    },
    advanceCareerCalendarTo,
    setDate,
    beginCalendarBatch,
    endCalendarBatch,
    isCalendarBatch,
    sameCalendarDay,
    setOnAdvanced,
  };
}

/** Restaura data serializada YYYY-MM-DD do save da temporada. */
export function parseSavedCalendarDate(raw, fallback = null) {
  if (!raw || typeof raw !== 'string') return fallback ? new Date(fallback) : null;
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return fallback ? new Date(fallback) : null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
