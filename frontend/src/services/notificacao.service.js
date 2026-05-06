import { apiGet, apiRequest } from './api';

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

export async function listarNotificacoes(filtros = {}) {
  return apiGet(`/notificacoes${montarQuery(filtros)}`);
}

export async function listarNotificacoesUrgentes() {
  return apiGet('/notificacoes/urgentes');
}

export async function marcarNotificacaoLida(id) {
  return apiRequest(`/notificacoes/${id}/lida`, {
    method: 'PATCH'
  });
}

export async function marcarPopupNotificacaoVisto(id) {
  return apiRequest(`/notificacoes/${id}/popup-visto`, {
    method: 'PATCH'
  });
}

export async function marcarTodasNotificacoesLidas() {
  return apiRequest('/notificacoes/lidas', {
    method: 'PATCH'
  });
}
