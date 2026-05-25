import { apiGet, apiPost, apiRequest } from './api';

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

export async function listarContatos() {
  return apiGet('/mensagens/contatos');
}

export async function listarConversas() {
  return apiGet('/mensagens/conversas');
}

export async function listarMensagens(contatoId, filtros = {}) {
  return apiGet(`/mensagens/conversas/${contatoId}${montarQuery(filtros)}`);
}

export async function enviarMensagem(destinatarioId, conteudo) {
  return apiPost('/mensagens', { destinatario_id: destinatarioId, conteudo });
}

export async function contarMensagensNaoLidas() {
  return apiGet('/mensagens/nao-lidas');
}

export async function marcarConversaLida(contatoId) {
  return apiRequest(`/mensagens/conversas/${contatoId}/lida`, {
    method: 'PATCH'
  });
}
