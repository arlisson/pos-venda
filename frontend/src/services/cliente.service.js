import { apiBlob, apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';

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

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportarClientesExcel(filtros = {}) {
  const blob = await apiBlob(`/clientes/exportar${montarQuery(filtros)}`);
  const data = new Date().toISOString().slice(0, 10);
  baixarBlob(blob, `clientes-${data}.xlsx`);
}

export async function listarClientesSelect(filtros = {}) {
  return apiGet(`/clientes/select${montarQuery(filtros)}`);
}

export async function listarClientesLixeira(filtros = {}) {
  return apiGet(`/clientes/lixeira${montarQuery(filtros)}`);
}

export async function buscarClientePorId(id) {
  return apiGet(`/clientes/${id}`);
}

export async function verificarDocumentoCliente(documento, ignorarId = null) {
  const query = ignorarId ? montarQuery({ ignorar_id: ignorarId }) : '';
  return apiGet(`/clientes/documento/${encodeURIComponent(documento)}${query}`);
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

export async function limparClientesBaseAnterior(opcoes = {}) {
  const query = opcoes.excluirVendasRelacionadas ? '?excluir_vendas_relacionadas=1' : '';
  return apiDelete(`/clientes/base-anterior${query}`);
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

export async function excluirClienteDefinitivo(id, opcoes = {}) {
  const query = opcoes.excluirVendasRelacionadas ? '?excluir_vendas_relacionadas=1' : '';
  return apiDelete(`/clientes/${id}/definitivo${query}`);
}
