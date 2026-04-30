import { apiGet, apiPost, apiPut } from './api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (Array.isArray(valor) && valor.length > 0) {
      params.set(chave, valor.join(','));
    } else if (valor !== undefined && valor !== null && valor !== '') {
      params.set(chave, valor);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listarLeadPlanilhas() {
  return apiGet('/lead-planilhas');
}

export function criarLeadPlanilha(dados) {
  return apiPost('/lead-planilhas', dados);
}

export function salvarLeadLinhas(planilhaId, linhas) {
  return apiPost(`/lead-planilhas/${planilhaId}/linhas`, { linhas });
}

export function atualizarLeadSchema(planilhaId, schema_colunas) {
  return apiPut(`/lead-planilhas/${planilhaId}/schema`, { schema_colunas });
}

export function listarLeadLinhas(filtros = {}) {
  return apiGet(`/lead-planilhas/linhas${montarQuery(filtros)}`);
}

export function dividirLeadLinhas(dados) {
  return apiPost('/lead-planilhas/dividir', dados);
}

export function listarLeadEnvios() {
  return apiGet('/lead-planilhas/envios');
}

export function listarMeusLeadEnvios() {
  return apiGet('/lead-planilhas/me/envios');
}

export function listarMinhasLeadLinhas(filtros = {}) {
  return apiGet(`/lead-planilhas/me/linhas${montarQuery(filtros)}`);
}
