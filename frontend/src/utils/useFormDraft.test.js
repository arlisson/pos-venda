import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormDraft } from './useFormDraft';

describe('useFormDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('salva o rascunho no localStorage apos o debounce', () => {
    renderHook(({ form }) => useFormDraft('venda_nova', form, false, 300), {
      initialProps: { form: { nome: 'Cliente Teste' } },
    });

    expect(localStorage.getItem('form_draft_venda_nova')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(JSON.parse(localStorage.getItem('form_draft_venda_nova'))).toEqual({ nome: 'Cliente Teste' });
  });

  it('nao salva rascunho quando esta editando', () => {
    renderHook(() => useFormDraft('venda_existente', { nome: 'Cliente Teste' }, true, 100));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(localStorage.getItem('form_draft_venda_existente')).toBeNull();
  });

  it('carrega, verifica e limpa rascunhos existentes', () => {
    localStorage.setItem('form_draft_cliente_novo', JSON.stringify({ nome: 'Maria' }));

    const { result } = renderHook(() => useFormDraft('cliente_novo', { nome: '' }, false, 500));

    expect(result.current.hasDraft()).toBe(true);
    expect(result.current.loadDraft()).toEqual({ nome: 'Maria' });

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.hasDraft()).toBe(false);
    expect(result.current.loadDraft()).toBeNull();
  });
});
