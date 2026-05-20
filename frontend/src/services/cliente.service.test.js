import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiRequest: vi.fn(),
}));

import { apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';
import {
  atualizarCliente,
  buscarClientePorId,
  criarCliente,
  excluirCliente,
  excluirClienteDefinitivo,
  importarBaseAnterior,
  limparClientesBaseAnterior,
  listarClientes,
  listarClientesLixeira,
  listarClientesSelect,
  previewImportacaoBaseAnterior,
  restaurarCliente,
} from './cliente.service';

describe('cliente.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monta queries ignorando filtros vazios', async () => {
    apiGet.mockResolvedValueOnce([]);

    await listarClientes({ busca: 'ana', pagina: 2, vazio: '', nulo: null, indefinido: undefined });

    expect(apiGet).toHaveBeenCalledWith('/clientes?busca=ana&pagina=2');
  });

  it('usa endpoints de listagem e leitura', async () => {
    await listarClientesSelect({ ativo: 1 });
    await listarClientesLixeira({ busca: 'x' });
    await buscarClientePorId(9);

    expect(apiGet).toHaveBeenNthCalledWith(1, '/clientes/select?ativo=1');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/clientes/lixeira?busca=x');
    expect(apiGet).toHaveBeenNthCalledWith(3, '/clientes/9');
  });

  it('usa endpoints de criacao, atualizacao, exclusao e restauracao', async () => {
    await criarCliente({ nome: 'Cliente' });
    await atualizarCliente(3, { nome: 'Novo' });
    await excluirCliente(3);
    await restaurarCliente(3);
    await limparClientesBaseAnterior();
    await excluirClienteDefinitivo(3, { excluirVendasRelacionadas: true });

    expect(apiPost).toHaveBeenNthCalledWith(1, '/clientes', { nome: 'Cliente' });
    expect(apiPut).toHaveBeenNthCalledWith(1, '/clientes/3', { nome: 'Novo' });
    expect(apiDelete).toHaveBeenNthCalledWith(1, '/clientes/3');
    expect(apiPost).toHaveBeenNthCalledWith(2, '/clientes/3/restaurar', {});
    expect(apiDelete).toHaveBeenNthCalledWith(2, '/clientes/base-anterior');
    expect(apiDelete).toHaveBeenNthCalledWith(3, '/clientes/3/definitivo?excluir_vendas_relacionadas=1');
  });

  it('envia importacao com FormData e mapeamento quando informado', async () => {
    const arquivo = new File(['a,b'], 'clientes.csv', { type: 'text/csv' });

    await previewImportacaoBaseAnterior(arquivo);
    await importarBaseAnterior(arquivo, { nome: 'Nome' });

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/clientes/importar-base-anterior/preview', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/clientes/importar-base-anterior', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(apiRequest.mock.calls[1][1].body.get('mapeamento')).toBe(JSON.stringify({ nome: 'Nome' }));
  });
});
