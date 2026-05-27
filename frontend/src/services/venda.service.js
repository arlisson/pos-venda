/**
 * Cliente de API para vendas, arquivos, importacoes, aprovacoes e pos-venda.
 */
import { apiBlob, apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
 * Executa a rotina listar vendas.
 */
export async function listarVendas(filtros) {
  return apiGet(`/vendas${montarQuery(filtros)}`);
}

/**
 * Executa a rotina exportar vendas excel.
 */
export async function exportarVendasExcel(filtros = {}) {
  const blob = await apiBlob(`/vendas/exportar${montarQuery(filtros)}`);
  const data = new Date().toISOString().slice(0, 10);
  baixarBlob(blob, `vendas-${data}.xlsx`);
}

/**
 * Executa a rotina contar vendas concluidas por cliente.
 */
export async function contarVendasConcluidasPorCliente() {
  return apiGet('/vendas/contagem-por-cliente');
}

/**
 * Executa a rotina obter referencias clientes vendas.
 */
export async function obterReferenciasClientesVendas() {
  return apiGet('/vendas/referencias-clientes');
}

/**
 * Executa a rotina listar vendas lixeira.
 */
export async function listarVendasLixeira(filtros) {
  return apiGet(`/vendas/lixeira${montarQuery(filtros)}`);
}

/**
 * Executa a rotina obter resumo vendas.
 */
export async function obterResumoVendas() {
  return apiGet('/vendas/resumo');
}

/**
 * Executa a rotina obter relatorios vendas.
 */
export async function obterRelatoriosVendas(filtros) {
  return apiGet(`/vendas/relatorios${montarQuery(filtros)}`);
}

/**
 * Executa a rotina buscar venda por id.
 */
export async function buscarVendaPorId(id) {
  return apiGet(`/vendas/${id}`);
}

/**
 * Executa a rotina gerar email venda.
 */
export async function gerarEmailVenda(id) {
  return apiPost(`/vendas/${id}/email-template`, {});
}

/**
 * Executa a rotina baixar xlsx claro.
 */
export async function baixarXlsxClaro(id, nomeCliente) {
  const blob = await apiBlob(`/vendas/${id}/xlsx-claro`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CHECKLIST PADRÃO - ${nomeCliente || id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Executa a rotina baixar blob.
 */
function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Executa a rotina listar arquivos venda.
 */
export async function listarArquivosVenda(id) {
  return apiGet(`/vendas/${id}/arquivos`);
}

/**
 * Executa a rotina upload arquivo venda.
 */
export function uploadArquivoVenda(id, file, dados = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('categoria', dados.categoria || 'outro');
    formData.append('descricao', dados.descricao || '');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/vendas/${id}/arquivos`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
          return;
        }

        reject(new Error(data?.message || data?.error || 'Erro no upload.'));
      } catch {
        reject(new Error('Erro no upload.'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Erro de rede no upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado.')));
    xhr.send(formData);
  });
}

/**
 * Executa a rotina excluir arquivo venda.
 */
export async function excluirArquivoVenda(vendaId, arquivoVendaId) {
  return apiDelete(`/vendas/${vendaId}/arquivos/${arquivoVendaId}`);
}

/**
 * Executa a rotina obter pacote arquivos venda.
 */
export async function obterPacoteArquivosVenda(vendaId) {
  return apiGet(`/vendas/${vendaId}/arquivos/pacote`);
}

/**
 * Executa a rotina gerar pacote arquivos venda.
 */
export async function gerarPacoteArquivosVenda(vendaId) {
  return apiPost(`/vendas/${vendaId}/arquivos/pacote`, {});
}

/**
 * Executa a rotina baixar arquivo venda.
 */
export async function baixarArquivoVenda(vendaId, arquivoVendaId, nomeArquivo) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/${arquivoVendaId}/download`);
  baixarBlob(blob, nomeArquivo || `venda-${vendaId}-arquivo`);
}

/**
 * Executa a rotina url visualizar arquivo venda.
 */
export function urlVisualizarArquivoVenda(vendaId, arquivoVendaId) {
  return `${API_URL}/vendas/${vendaId}/arquivos/${arquivoVendaId}/view`;
}

/**
 * Executa a rotina visualizar arquivo venda.
 */
export async function visualizarArquivoVenda(vendaId, arquivoVendaId) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/${arquivoVendaId}/view`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Executa a rotina baixar pacote arquivos venda.
 */
export async function baixarPacoteArquivosVenda(vendaId) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/pacote/download`);
  baixarBlob(blob, `venda-${vendaId}-documentos.zip`);
}

/**
 * Executa a rotina criar venda.
 */
export async function criarVenda(dados) {
  return apiPost('/vendas', dados);
}

/**
 * Executa a rotina montar form data importacao.
 */
function montarFormDataImportacao(arquivo, mapeamento) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  return formData;
}

/**
 * Executa a rotina preview importacao vendas empresas.
 */
export async function previewImportacaoVendasEmpresas(arquivo, mapeamento) {
  return apiRequest('/vendas/importar-empresas/preview', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo, mapeamento)
  });
}

/**
 * Executa a rotina importar vendas empresas.
 */
export async function importarVendasEmpresas(arquivo, mapeamento) {
  return apiRequest('/vendas/importar-empresas', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo, mapeamento)
  });
}

/**
 * Executa a rotina atualizar venda.
 */
export async function atualizarVenda(id, dados) {
  return apiPut(`/vendas/${id}`, dados);
}

/**
 * Executa a rotina enviar venda para pos venda.
 */
export async function enviarVendaParaPosVenda(id) {
  return apiPost(`/vendas/${id}/enviar-pos-venda`, {});
}

/**
 * Executa a rotina listar aprovacoes venda.
 */
export async function listarAprovacoesVenda(filtros) {
  return apiGet(`/vendas/aprovacoes${montarQuery(filtros)}`);
}

/**
 * Executa a rotina aprovar solicitacao venda.
 */
export async function aprovarSolicitacaoVenda(id, dados = {}) {
  return apiPost(`/vendas/aprovacoes/${id}/aprovar`, dados);
}

/**
 * Executa a rotina recusar solicitacao venda.
 */
export async function recusarSolicitacaoVenda(id, dados = {}) {
  return apiPost(`/vendas/aprovacoes/${id}/recusar`, dados);
}

/**
 * Executa a rotina atualizar status venda.
 */
export async function atualizarStatusVenda(id, dados) {
  return apiRequest(`/vendas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });
}

/**
 * Executa a rotina cancelar venda.
 */
export async function cancelarVenda(id, motivo) {
  return apiPost(`/vendas/${id}/cancelar`, { motivo });
}

/**
 * Executa a rotina reverter cancelamento venda.
 */
export async function reverterCancelamentoVenda(id, observacao) {
  return apiPost(`/vendas/${id}/reverter-cancelamento`, { observacao });
}

/**
 * Executa a rotina deletar venda.
 */
export async function deletarVenda(id) {
  return apiDelete(`/vendas/${id}`);
}

/**
 * Executa a rotina buscar problema ativo venda.
 */
export async function buscarProblemaAtivoVenda(id) {
  return apiGet(`/vendas/${id}/problemas/ativo`);
}

/**
 * Executa a rotina listar problemas venda.
 */
export async function listarProblemasVenda(id) {
  return apiGet(`/vendas/${id}/problemas`);
}

/**
 * Executa a rotina listar destinatarios problema venda.
 */
export async function listarDestinatariosProblemaVenda() {
  return apiGet('/vendas/problemas/destinatarios');
}

/**
 * Executa a rotina marcar problema venda.
 */
export async function marcarProblemaVenda(id, dados) {
  return apiPost(`/vendas/${id}/problemas`, dados);
}

/**
 * Executa a rotina resolver problema venda.
 */
export async function resolverProblemaVenda(problemaId, dados) {
  return apiPost(`/vendas/problemas/${problemaId}/resolver`, dados);
}

/**
 * Executa a rotina solicitar correcao problema venda.
 */
export async function solicitarCorrecaoProblemaVenda(problemaId, dados) {
  return apiPost(`/vendas/problemas/${problemaId}/correcao`, dados);
}

/**
 * Executa a rotina verificar problema venda.
 */
export async function verificarProblemaVenda(problemaId) {
  return apiPost(`/vendas/problemas/${problemaId}/verificar`, {});
}

/**
 * Executa a rotina restaurar venda.
 */
export async function restaurarVenda(id) {
  return apiPost(`/vendas/${id}/restaurar`, {});
}

/**
 * Executa a rotina deletar venda definitivo.
 */
export async function deletarVendaDefinitivo(id) {
  return apiDelete(`/vendas/${id}/definitivo`);
}

/**
 * Executa a rotina listar vendedoras.
 */
export async function listarVendedoras() {
  return apiGet('/vendas/vendedoras');
}
