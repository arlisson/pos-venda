import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RowDetailSheet, { RowDetailSheetField } from './RowDetailSheet';

describe('RowDetailSheet', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renderiza titulo, subtitulo, conteudo e footer quando aberto', () => {
    render(
      <RowDetailSheet open title="Venda 123" subtitle="Cliente Teste" footer={<button>Acao</button>}>
        <RowDetailSheetField label="Status">Aberta</RowDetailSheetField>
      </RowDetailSheet>
    );

    expect(screen.getByRole('dialog')).toHaveClass('is-open');
    expect(screen.getByText('Venda 123')).toBeInTheDocument();
    expect(screen.getByText('Cliente Teste')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acao' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('omite campos vazios', () => {
    const { container } = render(<RowDetailSheetField label="Vazio">{''}</RowDetailSheetField>);

    expect(container).toBeEmptyDOMElement();
  });

  it('chama onClose pelo botao e pela tecla Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <RowDetailSheet open title="Detalhes" onClose={onClose}>
        Conteudo
      </RowDetailSheet>
    );

    await user.click(screen.getByRole('button', { name: /voltar/i }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
