import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VendedorasSelect as VendedorasSelectModal } from './VendaModal';
import { VendedorasSelect as VendedorasSelectPage } from './VendasPage';

const options = [
  { id: 1, nome: 'Ana' },
  { id: 2, nome: 'Bruna' },
  { id: 3, nome: 'Cárla' },
];

// Os dois componentes são duplicados (VendaModal e VendasPage); a busca deve
// se comportar igual nos dois, então rodamos a mesma suíte contra ambos.
const variantes = [
  ['VendaModal', VendedorasSelectModal],
  ['VendasPage', VendedorasSelectPage],
];

describe.each(variantes)('VendedorasSelect (%s) — busca', (_nome, VendedorasSelect) => {
  async function abrirDropdown(user) {
    await user.click(screen.getByRole('button', { name: /adicionar vendedora/i }));
    return screen.getByRole('searchbox', { name: /buscar vendedora/i });
  }

  it('lista todas as vendedoras disponíveis ao abrir', async () => {
    const user = userEvent.setup();
    render(<VendedorasSelect value={[]} options={options} onChange={vi.fn()} />);

    await abrirDropdown(user);

    expect(screen.getByRole('button', { name: /ana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bruna/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cárla/i })).toBeInTheDocument();
  });

  it('filtra pelo texto digitado (ignorando acentos)', async () => {
    const user = userEvent.setup();
    render(<VendedorasSelect value={[]} options={options} onChange={vi.fn()} />);

    const busca = await abrirDropdown(user);
    await user.type(busca, 'carla'); // sem acento, deve casar com "Cárla"

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cárla/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ana/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /bruna/i })).not.toBeInTheDocument();
    });
  });

  it('mostra estado vazio quando nenhuma vendedora casa', async () => {
    const user = userEvent.setup();
    render(<VendedorasSelect value={[]} options={options} onChange={vi.fn()} />);

    const busca = await abrirDropdown(user);
    await user.type(busca, 'inexistente');

    await waitFor(() => {
      expect(screen.getByText(/nenhuma vendedora encontrada/i)).toBeInTheDocument();
    });
  });

  it('adiciona a vendedora ao clicar na opção filtrada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VendedorasSelect value={[]} options={options} onChange={onChange} />);

    const busca = await abrirDropdown(user);
    await user.type(busca, 'bru');
    await user.click(await screen.findByRole('button', { name: /bruna/i }));

    expect(onChange).toHaveBeenCalledWith(['2']);
  });

  it('não exibe vendedoras já selecionadas na lista de disponíveis', async () => {
    const user = userEvent.setup();
    render(<VendedorasSelect value={['1']} options={options} onChange={vi.fn()} />);

    await abrirDropdown(user);

    // Ana (id 1) já está selecionada -> vira chip, não aparece como opção do dropdown.
    expect(screen.queryByRole('button', { name: /bruna/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /buscar vendedora/i })).toBeInTheDocument();
  });
});
