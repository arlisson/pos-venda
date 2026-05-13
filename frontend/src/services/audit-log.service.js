import { apiGet } from './api';

export async function listarAuditLogs({ busca = '', limite = 160, entidade = '' } = {}) {
  const params = new URLSearchParams();

  if (busca) {
    params.set('busca', busca);
  }

  if (limite) {
    params.set('limite', limite);
  }

  if (entidade) {
    params.set('entidade', entidade);
  }

  const query = params.toString();

  return apiGet(`/audit-logs${query ? `?${query}` : ''}`);
}

export async function listarStatusVendasHistorico() {
  return apiGet('/audit-logs/vendas-status');
}
