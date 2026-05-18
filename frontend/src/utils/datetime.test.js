import { describe, expect, it } from 'vitest';
import {
  formatDateValue,
  formatUtcDateTime,
  getUtcDateTimeTimestamp,
  isDateOnlyString,
  parseDateValue,
  parseUtcDateTime,
  toLocalDateTimeInputFromUtc,
} from './datetime';

describe('datetime utils', () => {
  it('identifica strings de data no formato YYYY-MM-DD', () => {
    expect(isDateOnlyString('2026-05-18')).toBe(true);
    expect(isDateOnlyString(' 2026-05-18 ')).toBe(true);
    expect(isDateOnlyString('18/05/2026')).toBe(false);
    expect(isDateOnlyString('2026-05-18T10:00:00Z')).toBe(false);
  });

  it('rejeita datas inexistentes ou vazias', () => {
    expect(parseDateValue('2026-02-30')).toBeNull();
    expect(parseDateValue('')).toBeNull();
    expect(parseUtcDateTime('2026-05-18')).toBeNull();
    expect(formatDateValue('2026-02-30', undefined, 'sem data')).toBe('sem data');
  });

  it('interpreta data e hora UTC com timestamp correto', () => {
    expect(getUtcDateTimeTimestamp('2026-05-18T13:45:00Z')).toBe(Date.UTC(2026, 4, 18, 13, 45));
    expect(parseUtcDateTime('2026-05-18 13:45:00')?.toISOString()).toBe('2026-05-18T13:45:00.000Z');
  });

  it('formata datas usando fallback quando o valor e invalido', () => {
    expect(formatDateValue('2026-05-18')).toBe('18/05/26');
    expect(formatUtcDateTime(null, undefined, 'sem data')).toBe('sem data');
  });

  it('converte data UTC para valor compativel com input datetime-local', () => {
    const convertido = toLocalDateTimeInputFromUtc('2026-05-18T13:45:00Z');

    expect(convertido).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(toLocalDateTimeInputFromUtc('2026-05-18')).toBe('');
  });
});
