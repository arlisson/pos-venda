import { apiGet } from './api';

export async function listarAuditLogs({ busca = '', limite = 160 } = {}) {
  const params = new URLSearchParams();

  if (busca) {
    params.set('busca', busca);
  }

  if (limite) {
    params.set('limite', limite);
  }

  const query = params.toString();

  return apiGet(`/audit-logs${query ? `?${query}` : ''}`);
}
