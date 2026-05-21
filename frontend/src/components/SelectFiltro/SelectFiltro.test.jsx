import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SelectFiltro from './SelectFiltro';

const options = [
  { value: 'claro', label: 'Claro' },
  { value: 'vivo', label: 'Vivo' },
  { value: 'tim', label: 'TIM', disabled: true },
];

describe('SelectFiltro', () => {
  it('mostra placeholder quando nao ha valor selecionado', () => {
    render(<SelectFiltro value="" onChange={vi.fn()} options={options} placeholder="Todas" />);

    expect(screen.getByRole('button', { name: /todas/i })).toBeInTheDocument();
  });

  it('mostra a opcao selecionada', () => {
    render(<SelectFiltro value="vivo" onChange={vi.fn()} options={options} placeholder="Todas" />);

    expect(screen.getByRole('button', { name: /vivo/i })).toBeInTheDocument();
  });

  it('abre o menu e seleciona uma opcao normal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectFiltro value="" onChange={onChange} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    expect(screen.getByRole('button', { name: /claro/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /claro/i }));
    expect(onChange).toHaveBeenCalledWith('claro');
    await waitFor(() => expect(screen.queryByRole('button', { name: /claro/i })).not.toBeInTheDocument());
  });

  it('filtra opcoes pelo texto buscado', async () => {
    const user = userEvent.setup();

    render(<SelectFiltro value="" onChange={vi.fn()} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    await user.type(screen.getByRole('searchbox', { name: /buscar filtro/i }), 'viv');

    expect(screen.getByRole('button', { name: /vivo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claro/i })).not.toBeInTheDocument();
  });

  it('mantem placeholder disponivel mesmo com busca sem resultado', async () => {
    const user = userEvent.setup();

    render(<SelectFiltro value="vivo" onChange={vi.fn()} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /vivo/i }));
    await user.type(screen.getByRole('searchbox', { name: /buscar filtro/i }), 'inexistente');

    expect(screen.getByRole('button', { name: /todas/i })).toBeInTheDocument();
    expect(screen.getByText(/nenhuma op[cç][aã]o encontrada/i)).toBeInTheDocument();
  });

  it('navega com as setas e seleciona com Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectFiltro value="" onChange={onChange} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    // 0=placeholder -> 1=Claro -> 2=Vivo
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('vivo');
  });

  it('pula opcao desabilitada na navegacao por teclado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectFiltro value="" onChange={onChange} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    // 0 -> 1(Claro) -> 2(Vivo) -> pula 3(TIM desabilitada) -> volta a 0(placeholder)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('ignora opcao desabilitada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SelectFiltro value="" onChange={onChange} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    await user.click(screen.getByRole('button', { name: /tim/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /tim/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('fecha o menu com Escape', async () => {
    const user = userEvent.setup();

    render(<SelectFiltro value="" onChange={vi.fn()} options={options} placeholder="Todas" />);

    await user.click(screen.getByRole('button', { name: /todas/i }));
    expect(screen.getByRole('button', { name: /vivo/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: /vivo/i })).not.toBeInTheDocument());
  });
});
