import { apiGet } from './api';

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

export async function listarAuditLogs({ busca = '', entidade = '', tipo = '', page, per_page } = {}) {
  return apiGet(`/audit-logs${montarQuery({ busca, entidade, tipo, page, per_page })}`);
}

export async function listarHistoricoVendasAgrupado({ status = '', busca = '', page, per_page } = {}) {
  return apiGet(`/audit-logs/vendas-agrupado${montarQuery({ status, busca, page, per_page })}`);
}
