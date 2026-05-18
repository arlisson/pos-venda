import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mantem o valor inicial ate o delay terminar', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'inicial', delay: 300 },
    });

    expect(result.current).toBe('inicial');

    rerender({ value: 'atualizado', delay: 300 });
    expect(result.current).toBe('inicial');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('inicial');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('atualizado');
  });

  it('cancela timers anteriores quando o valor muda novamente', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });
});
