/**
 * Cliente de API para historico de auditoria e eventos agrupados de vendas.
 */
import { apiGet } from './api';

/**
 * Monta query a partir dos dados informados.
 */
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

/**
 * Lista audit logs conforme os filtros e parametros informados.
 */
export async function listarAuditLogs({ busca = '', entidade = '', tipo = '', page, per_page } = {}) {
  return apiGet(`/audit-logs${montarQuery({ busca, entidade, tipo, page, per_page })}`);
}

/**
 * Lista historico vendas agrupado conforme os filtros e parametros informados.
 */
export async function listarHistoricoVendasAgrupado({ status = '', busca = '', page, per_page } = {}) {
  return apiGet(`/audit-logs/vendas-agrupado${montarQuery({ status, busca, page, per_page })}`);
}
