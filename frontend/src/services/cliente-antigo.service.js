/**
 * Cliente de API para a ferramenta de busca de clientes antigos.
 */
import { apiDelete, apiGet, apiRequest } from './api';
import { sanitizarCnpj } from './cnpj.service';

/**
 * Busca vendas antigas por CNPJ, CPF ou razao social.
 * O termo vai cru: pode ser um documento ou um trecho de nome.
 * @returns {Promise<{ tipo: 'documento'|'nome', encontrado: boolean, venda: object|null, resultados: object[], total: number }>}
 */
export async function buscarClienteAntigo(termo, paginacao = {}) {
  const params = new URLSearchParams({ termo: String(termo || '').trim() });
  if (paginacao.page) params.append('page', paginacao.page);
  if (paginacao.per_page) params.append('per_page', paginacao.per_page);
  return apiGet(`/clientes-antigos/buscar?${params.toString()}`);
}

function normalizarValorFiltro(chave, valor) {
  if (chave !== 'busca') return valor;

  const texto = String(valor || '').trim();
  const digitos = sanitizarCnpj(texto);
  const contemApenasDocumento = digitos && texto.replace(/[0-9.\-/\s]/g, '') === '';

  return contemApenasDocumento ? digitos : valor;
}

/**
 * Lista paginada do historico de buscas.
 */
export async function listarHistoricoClientesAntigos(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.append(chave, normalizarValorFiltro(chave, valor));
    }
  });
  const query = params.toString();
  return apiGet(`/clientes-antigos/historico${query ? `?${query}` : ''}`);
}

export async function atualizarClienteAntigo(id, dados) {
  return apiRequest(`/clientes-antigos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });
}

export async function excluirClienteAntigo(id) {
  return apiDelete(`/clientes-antigos/${id}`);
}
function montarFormDataPlanilha(arquivo, mapeamento, abas = null) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  if (Array.isArray(abas)) {
    formData.append('abas', JSON.stringify(abas));
  }
  return formData;
}

export async function previewPlanilhaClientesAntigos(arquivo) {
  return apiRequest('/clientes-antigos/planilha/preview', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo)
  });
}

export async function importarPlanilhaClientesAntigos(arquivo, mapeamento, abas = null) {
  return apiRequest('/clientes-antigos/planilha/importar', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo, mapeamento, abas)
  });
}
