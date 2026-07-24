const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const DEFAULT_DATE_OPTIONS = {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit'
};

const DEFAULT_DATE_TIME_OPTIONS = {
  ...DEFAULT_DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit'
};

/**
 * Verifica se valid date atende a condicao esperada.
 */
function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Converte date only para o formato interno esperado.
 */
function parseDateOnly(value) {
  const text = String(value || '').trim();
  if (!DATE_ONLY_RE.test(text)) return null;

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const matchesInput = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;

  return isValidDate(date) && matchesInput ? date : null;
}

/**
 * Indica se o valor textual esta no formato ISO somente data.
 *
 * @param {unknown} value - Valor a validar.
 * @returns {boolean} Verdadeiro quando o valor segue YYYY-MM-DD.
 */
export function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

/**
 * Converte data/hora UTC em Date, tratando strings sem timezone como UTC.
 *
 * @param {unknown} value - Date, timestamp ou string de data/hora.
 * @returns {Date|null} Data valida ou null.
 */
export function parseUtcDateTime(value) {
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

/**
 * Converte datas ISO de calendario e data/hora em Date local seguro.
 *
 * @param {unknown} value - Date, timestamp, YYYY-MM-DD ou data/hora.
 * @returns {Date|null} Data valida ou null.
 */
export function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date || typeof value === 'number') {
    return parseUtcDateTime(value);
  }

  return parseDateOnly(value) || parseUtcDateTime(value);
}

/**
 * Retorna o timestamp de uma data/hora UTC ou um fallback.
 *
 * @param {unknown} value - Valor de data/hora.
 * @param {number} [fallback=0] - Valor usado quando a data e invalida.
 * @returns {number} Timestamp em milissegundos.
 */
export function getUtcDateTimeTimestamp(value, fallback = 0) {
  const date = parseUtcDateTime(value);
  return date ? date.getTime() : fallback;
}

/**
 * Formata uma data/hora UTC no fuso local para exibicao em pt-BR.
 *
 * @param {unknown} value - Valor de data/hora UTC.
 * @param {Intl.DateTimeFormatOptions} [options=DEFAULT_DATE_TIME_OPTIONS] - Opcoes de formatacao.
 * @param {string} [fallback=''] - Texto retornado quando a data e invalida.
 * @returns {string} Data/hora formatada.
 */
export function formatUtcDateTime(value, options = DEFAULT_DATE_TIME_OPTIONS, fallback = '') {
  const date = parseUtcDateTime(value);
  return date ? date.toLocaleString('pt-BR', options) : fallback;
}

/**
 * Formata uma data de calendario para exibicao em pt-BR.
 *
 * @param {unknown} value - Valor de data.
 * @param {Intl.DateTimeFormatOptions} [options=DEFAULT_DATE_OPTIONS] - Opcoes de formatacao.
 * @param {string} [fallback=''] - Texto retornado quando a data e invalida.
 * @returns {string} Data formatada.
 */
export function formatDateValue(value, options = DEFAULT_DATE_OPTIONS, fallback = '') {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString('pt-BR', options) : fallback;
}

/**
 * Converte uma data/hora UTC para valor aceito por input datetime-local.
 *
 * @param {unknown} value - Valor de data/hora UTC.
 * @returns {string} Valor YYYY-MM-DDTHH:mm ou string vazia.
 */
export function toLocalDateTimeInputFromUtc(value) {
  const date = parseUtcDateTime(value);
  if (!date) return '';

  /**
   * Preenche valores numericos com zero a esquerda.
   */
  const pad = part => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + 'T' + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(':');
}

/** Converte o valor de um input datetime-local para o instante UTC a persistir. */
export function localDateTimeInputToUtc(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  const valid = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute;

  return valid ? date.toISOString() : null;
}
