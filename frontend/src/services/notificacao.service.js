/**
 * Cliente de API para notificacoes, leitura e popups.
 */
import { apiGet, apiRequest } from './api';

/**
 * Executa a rotina montar query.
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
 * Executa a rotina listar notificacoes.
 */
export async function listarNotificacoes(filtros = {}) {
  return apiGet(`/notificacoes${montarQuery(filtros)}`);
}

/**
 * Executa a rotina listar notificacoes urgentes.
 */
export async function listarNotificacoesUrgentes() {
  return apiGet('/notificacoes/urgentes');
}

/**
 * Executa a rotina marcar notificacao lida.
 */
export async function marcarNotificacaoLida(id) {
  return apiRequest(`/notificacoes/${id}/lida`, {
    method: 'PATCH'
  });
}

/**
 * Executa a rotina marcar popup notificacao visto.
 */
export async function marcarPopupNotificacaoVisto(id) {
  return apiRequest(`/notificacoes/${id}/popup-visto`, {
    method: 'PATCH'
  });
}

/**
 * Executa a rotina marcar todas notificacoes lidas.
 */
export async function marcarTodasNotificacoesLidas() {
  return apiRequest('/notificacoes/lidas', {
    method: 'PATCH'
  });
}
