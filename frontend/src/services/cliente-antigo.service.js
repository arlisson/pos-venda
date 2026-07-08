/**
 * Cliente de API para a ferramenta de busca de clientes antigos.
 */
import { apiGet, apiRequest } from './api';
import { sanitizarCnpj } from './cnpj.service';

/**
 * Busca uma venda antiga pelo CNPJ informado.
 * @returns {Promise<{ encontrado: boolean, venda: object|null }>}
 */
export async function buscarClienteAntigo(cnpj) {
  const digitos = sanitizarCnpj(cnpj);
  return apiGet(`/clientes-antigos/buscar?cnpj=${digitos}`);
}

/**
 * Lista paginada do historico de buscas.
 */
export async function listarHistoricoClientesAntigos(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.append(chave, valor);
    }
  });
  const query = params.toString();
  return apiGet(`/clientes-antigos/historico${query ? `?${query}` : ''}`);
}

function montarFormDataPlanilha(arquivo, mapeamento) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  return formData;
}

export async function previewPlanilhaClientesAntigos(arquivo) {
  return apiRequest('/clientes-antigos/planilha/preview', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo)
  });
}

export async function importarPlanilhaClientesAntigos(arquivo, mapeamento) {
  return apiRequest('/clientes-antigos/planilha/importar', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo, mapeamento)
  });
}
