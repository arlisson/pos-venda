import { apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';

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

export async function listarClientesLixeira(filtros = {}) {
  return apiGet(`/clientes/lixeira${montarQuery(filtros)}`);
}

export async function buscarClientePorId(id) {
  return apiGet(`/clientes/${id}`);
}

export async function criarCliente(dados) {
  return apiPost('/clientes', dados);
}

function montarFormDataImportacao(arquivo, mapeamento) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  return formData;
}

export async function previewImportacaoBaseAnterior(arquivo) {
  return apiRequest('/clientes/importar-base-anterior/preview', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo)
  });
}

export async function importarBaseAnterior(arquivo, mapeamento) {
  return apiRequest('/clientes/importar-base-anterior', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo, mapeamento)
  });
}

export async function atualizarCliente(id, dados) {
  return apiPut(`/clientes/${id}`, dados);
}

export async function excluirCliente(id) {
  return apiDelete(`/clientes/${id}`);
}

export async function restaurarCliente(id) {
  return apiPost(`/clientes/${id}/restaurar`, {});
}

export async function excluirClienteDefinitivo(id) {
  return apiDelete(`/clientes/${id}/definitivo`);
}
