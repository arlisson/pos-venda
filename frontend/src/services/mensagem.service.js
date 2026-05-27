/**
 * Cliente de API para mensagens internas, conversas e anexos.
 */
import { apiGet, apiPost, apiRequest, apiBlob, apiDelete } from './api';

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
 * Executa a rotina listar contatos.
 */
export async function listarContatos() {
  return apiGet('/mensagens/contatos');
}

/**
 * Executa a rotina listar conversas.
 */
export async function listarConversas() {
  return apiGet('/mensagens/conversas');
}

/**
 * Executa a rotina listar todas conversas.
 */
export async function listarTodasConversas() {
  return apiGet('/mensagens/admin/conversas');
}

/**
 * Executa a rotina listar mensagens.
 */
export async function listarMensagens(contatoId, filtros = {}) {
  return apiGet(`/mensagens/conversas/${contatoId}${montarQuery(filtros)}`);
}

/**
 * Executa a rotina listar mensagens conversa interna.
 */
export async function listarMensagensConversaInterna(conversaKey, filtros = {}) {
  return apiGet(`/mensagens/admin/conversas/${conversaKey}${montarQuery(filtros)}`);
}

/**
 * Executa a rotina enviar mensagem.
 */
export async function enviarMensagem(destinatarioId, conteudo, anexo = null) {
  const corpo = { destinatario_id: destinatarioId, conteudo };
  if (anexo?.arquivo_id) {
    corpo.arquivo_id = anexo.arquivo_id;
    corpo.nome_arquivo = anexo.nome_original;
  }
  return apiPost('/mensagens', corpo);
}

/**
 * Executa a rotina upload anexo mensagem.
 */
export async function uploadAnexoMensagem(file) {
  const formData = new FormData();
  formData.append('arquivo', file, file.name);
  return apiRequest('/mensagens/anexos', { method: 'POST', body: formData });
}

/**
 * Executa a rotina baixar anexo mensagem.
 */
export async function baixarAnexoMensagem(mensagemArquivoId) {
  return apiBlob(`/mensagens/anexos/${mensagemArquivoId}`);
}

/**
 * Executa a rotina baixar anexo mensagem interna.
 */
export async function baixarAnexoMensagemInterna(mensagemArquivoId) {
  return apiBlob(`/mensagens/admin/anexos/${mensagemArquivoId}`);
}

/**
 * Executa a rotina excluir mensagem.
 */
export async function excluirMensagem(mensagemId) {
  return apiDelete(`/mensagens/${mensagemId}`);
}

/**
 * Executa a rotina contar mensagens nao lidas.
 */
export async function contarMensagensNaoLidas() {
  return apiGet('/mensagens/nao-lidas');
}

/**
 * Executa a rotina marcar conversa lida.
 */
export async function marcarConversaLida(contatoId) {
  return apiRequest(`/mensagens/conversas/${contatoId}/lida`, {
    method: 'PATCH'
  });
}
