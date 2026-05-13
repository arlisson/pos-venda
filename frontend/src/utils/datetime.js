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

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

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

export function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

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

export function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date || typeof value === 'number') {
    return parseUtcDateTime(value);
  }

  return parseDateOnly(value) || parseUtcDateTime(value);
}

export function getUtcDateTimeTimestamp(value, fallback = 0) {
  const date = parseUtcDateTime(value);
  return date ? date.getTime() : fallback;
}

export function formatUtcDateTime(value, options = DEFAULT_DATE_TIME_OPTIONS, fallback = '') {
  const date = parseUtcDateTime(value);
  return date ? date.toLocaleString('pt-BR', options) : fallback;
}

export function formatDateValue(value, options = DEFAULT_DATE_OPTIONS, fallback = '') {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString('pt-BR', options) : fallback;
}

export function toLocalDateTimeInputFromUtc(value) {
  const date = parseUtcDateTime(value);
  if (!date) return '';

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
