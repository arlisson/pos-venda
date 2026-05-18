import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AutoResizeTextarea from './AutoResizeTextarea';

describe('AutoResizeTextarea', () => {
  it('renderiza valor vazio quando value e nulo', () => {
    render(<AutoResizeTextarea aria-label="Observacoes" value={null} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Observacoes')).toHaveValue('');
  });

  it('repassa alteracoes e usa title com o valor atual', () => {
    const onChange = vi.fn();
    render(<AutoResizeTextarea aria-label="Observacoes" value="Texto atual" onChange={onChange} />);

    const textarea = screen.getByLabelText('Observacoes');
    expect(textarea).toHaveAttribute('title', 'Texto atual');

    fireEvent.change(textarea, { target: { value: 'Novo texto' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('ajusta altura respeitando minRows e maxRows', () => {
    const { rerender } = render(<AutoResizeTextarea aria-label="Descricao" value="Linha 1" onChange={vi.fn()} minRows={2} maxRows={3} />);

    const textarea = screen.getByLabelText('Descricao');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 });

    rerender(<AutoResizeTextarea aria-label="Descricao" value={'Linha 1\nLinha 2\nLinha 3\nLinha 4'} onChange={vi.fn()} minRows={2} maxRows={3} />);

    expect(textarea.style.height).toBe('60px');
    expect(textarea.style.overflowY).toBe('auto');
  });
});
