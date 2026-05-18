import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Botao from './Botao';

describe('Botao', () => {
  it('renderiza titulo e chama onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Botao title="Salvar" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: /salvar/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('mostra carregando e desabilita interacao', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Botao title="Salvar" carregando onClick={onClick} />);

    const botao = screen.getByRole('button', { name: /carregando/i });
    expect(botao).toBeDisabled();

    await user.click(botao);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aplica variante secundaria sem classe primary', () => {
    render(<Botao title="Cancelar" variant="secondary" />);

    expect(screen.getByRole('button', { name: /cancelar/i })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: /cancelar/i })).not.toHaveClass('btn-primary');
  });
});
