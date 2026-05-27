const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Indica se o objeto Date possui timestamp valido.
 *
 * @param {unknown} date - Valor a validar.
 * @returns {boolean} Verdadeiro quando e Date valido.
 */
function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Converte data/hora UTC em Date, tratando strings sem timezone como UTC.
 *
 * @param {unknown} value - Date, timestamp ou string de data/hora.
 * @returns {Date|null} Data valida ou null.
 */
function parseUtcDateTime(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  const text = String(value).trim();
  if (!text || DATE_ONLY_RE.test(text)) return null;

  const normalized = text.replace(' ', 'T');
  const date = new Date(HAS_TIMEZONE_RE.test(normalized) ? normalized : `${normalized}Z`);

  return isValidDate(date) ? date : null;
}

module.exports = {
  parseUtcDateTime
};
