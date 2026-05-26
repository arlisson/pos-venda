import { apiGet, apiPost, apiRequest, apiBlob, apiDelete } from './api';

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

export async function listarTodasConversas() {
  return apiGet('/mensagens/admin/conversas');
}

export async function listarMensagens(contatoId, filtros = {}) {
  return apiGet(`/mensagens/conversas/${contatoId}${montarQuery(filtros)}`);
}

export async function listarMensagensConversaInterna(conversaKey, filtros = {}) {
  return apiGet(`/mensagens/admin/conversas/${conversaKey}${montarQuery(filtros)}`);
}

export async function enviarMensagem(destinatarioId, conteudo, anexo = null) {
  const corpo = { destinatario_id: destinatarioId, conteudo };
  if (anexo?.arquivo_id) {
    corpo.arquivo_id = anexo.arquivo_id;
    corpo.nome_arquivo = anexo.nome_original;
  }
  return apiPost('/mensagens', corpo);
}

export async function uploadAnexoMensagem(file) {
  const formData = new FormData();
  formData.append('arquivo', file, file.name);
  return apiRequest('/mensagens/anexos', { method: 'POST', body: formData });
}

export async function baixarAnexoMensagem(mensagemArquivoId) {
  return apiBlob(`/mensagens/anexos/${mensagemArquivoId}`);
}

export async function baixarAnexoMensagemInterna(mensagemArquivoId) {
  return apiBlob(`/mensagens/admin/anexos/${mensagemArquivoId}`);
}

export async function excluirMensagem(mensagemId) {
  return apiDelete(`/mensagens/${mensagemId}`);
}

export async function contarMensagensNaoLidas() {
  return apiGet('/mensagens/nao-lidas');
}

export async function marcarConversaLida(contatoId) {
  return apiRequest(`/mensagens/conversas/${contatoId}/lida`, {
    method: 'PATCH'
  });
}
