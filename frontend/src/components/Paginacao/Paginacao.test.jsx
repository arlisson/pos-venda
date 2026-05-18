import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Paginacao from './Paginacao';

describe('Paginacao', () => {
  it('nao renderiza quando total e zero', () => {
    const { container } = render(
      <Paginacao total={0} paginaAtual={1} itensPorPagina={20} onPagina={vi.fn()} onItensPorPagina={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('mostra intervalo atual e paginas disponiveis', () => {
    render(
      <Paginacao total={55} paginaAtual={2} itensPorPagina={20} onPagina={vi.fn()} onItensPorPagina={vi.fn()} />
    );

    expect(screen.getByText(/21.*40 de 55/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('desabilita navegacao anterior e proxima nas bordas', () => {
    const { rerender } = render(
      <Paginacao total={55} paginaAtual={1} itensPorPagina={20} onPagina={vi.fn()} onItensPorPagina={vi.fn()} />
    );

    expect(screen.getAllByRole('button')[0]).toBeDisabled();

    rerender(<Paginacao total={55} paginaAtual={3} itensPorPagina={20} onPagina={vi.fn()} onItensPorPagina={vi.fn()} />);
    expect(screen.getAllByRole('button').at(-1)).toBeDisabled();
  });

  it('chama callbacks ao trocar pagina e itens por pagina', async () => {
    const user = userEvent.setup();
    const onPagina = vi.fn();
    const onItensPorPagina = vi.fn();

    render(
      <Paginacao total={120} paginaAtual={3} itensPorPagina={20} onPagina={onPagina} onItensPorPagina={onItensPorPagina} />
    );

    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByLabelText(/por página/i));
    await user.click(screen.getByRole('option', { name: '50' }));

    expect(onPagina).toHaveBeenCalledWith(4);
    expect(onItensPorPagina).toHaveBeenCalledWith(50);
  });
});
