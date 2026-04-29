import { apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.append(chave, valor);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listarVendas(filtros) {
  return apiGet(`/vendas${montarQuery(filtros)}`);
}

export async function listarVendasLixeira(filtros) {
  return apiGet(`/vendas/lixeira${montarQuery(filtros)}`);
}

export async function obterResumoVendas() {
  return apiGet('/vendas/resumo');
}

export async function buscarVendaPorId(id) {
  return apiGet(`/vendas/${id}`);
}

export async function criarVenda(dados) {
  return apiPost('/vendas', dados);
}

export async function atualizarVenda(id, dados) {
  return apiPut(`/vendas/${id}`, dados);
}

export async function atualizarStatusVenda(id, dados) {
  return apiRequest(`/vendas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });
}

export async function deletarVenda(id) {
  return apiDelete(`/vendas/${id}`);
}

export async function restaurarVenda(id) {
  return apiPost(`/vendas/${id}/restaurar`, {});
}

export async function deletarVendaDefinitivo(id) {
  return apiDelete(`/vendas/${id}/definitivo`);
}

export async function listarVendedoras() {
  return apiGet('/vendas/vendedoras');
}
