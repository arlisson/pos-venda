import { apiDelete, apiGet, apiPost, apiPut } from './api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.set(chave, valor);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listarClientes(filtros = {}) {
  return apiGet(`/clientes${montarQuery(filtros)}`);
}

export async function buscarClientePorId(id) {
  return apiGet(`/clientes/${id}`);
}

export async function criarCliente(dados) {
  return apiPost('/clientes', dados);
}

export async function atualizarCliente(id, dados) {
  return apiPut(`/clientes/${id}`, dados);
}

export async function excluirCliente(id) {
  return apiDelete(`/clientes/${id}`);
}
