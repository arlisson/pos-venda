import { apiBlob, apiDelete, apiGet, apiPost, apiPut, apiRequest } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

export async function listarVendas(filtros) {
  return apiGet(`/vendas${montarQuery(filtros)}`);
}

export async function contarVendasConcluidasPorCliente() {
  return apiGet('/vendas/contagem-por-cliente');
}

export async function obterReferenciasClientesVendas() {
  return apiGet('/vendas/referencias-clientes');
}

export async function listarVendasLixeira(filtros) {
  return apiGet(`/vendas/lixeira${montarQuery(filtros)}`);
}

export async function obterResumoVendas() {
  return apiGet('/vendas/resumo');
}

export async function obterRelatoriosVendas(filtros) {
  return apiGet(`/vendas/relatorios${montarQuery(filtros)}`);
}

export async function buscarVendaPorId(id) {
  return apiGet(`/vendas/${id}`);
}

export async function gerarEmailVenda(id) {
  return apiPost(`/vendas/${id}/email-template`, {});
}

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

export async function listarArquivosVenda(id) {
  return apiGet(`/vendas/${id}/arquivos`);
}

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

export async function excluirArquivoVenda(vendaId, arquivoVendaId) {
  return apiDelete(`/vendas/${vendaId}/arquivos/${arquivoVendaId}`);
}

export async function obterPacoteArquivosVenda(vendaId) {
  return apiGet(`/vendas/${vendaId}/arquivos/pacote`);
}

export async function gerarPacoteArquivosVenda(vendaId) {
  return apiPost(`/vendas/${vendaId}/arquivos/pacote`, {});
}

export async function baixarArquivoVenda(vendaId, arquivoVendaId, nomeArquivo) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/${arquivoVendaId}/download`);
  baixarBlob(blob, nomeArquivo || `venda-${vendaId}-arquivo`);
}

export function urlVisualizarArquivoVenda(vendaId, arquivoVendaId) {
  return `${API_URL}/vendas/${vendaId}/arquivos/${arquivoVendaId}/view`;
}

export async function visualizarArquivoVenda(vendaId, arquivoVendaId) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/${arquivoVendaId}/view`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function baixarPacoteArquivosVenda(vendaId) {
  const blob = await apiBlob(`/vendas/${vendaId}/arquivos/pacote/download`);
  baixarBlob(blob, `venda-${vendaId}-documentos.zip`);
}

export async function criarVenda(dados) {
  return apiPost('/vendas', dados);
}

function montarFormDataImportacao(arquivo, mapeamento) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  return formData;
}

export async function previewImportacaoVendasEmpresas(arquivo, mapeamento) {
  return apiRequest('/vendas/importar-empresas/preview', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo, mapeamento)
  });
}

export async function importarVendasEmpresas(arquivo, mapeamento) {
  return apiRequest('/vendas/importar-empresas', {
    method: 'POST',
    body: montarFormDataImportacao(arquivo, mapeamento)
  });
}

export async function atualizarVenda(id, dados) {
  return apiPut(`/vendas/${id}`, dados);
}

export async function enviarVendaParaPosVenda(id) {
  return apiPost(`/vendas/${id}/enviar-pos-venda`, {});
}

export async function listarAprovacoesVenda(filtros) {
  return apiGet(`/vendas/aprovacoes${montarQuery(filtros)}`);
}

export async function aprovarSolicitacaoVenda(id, dados = {}) {
  return apiPost(`/vendas/aprovacoes/${id}/aprovar`, dados);
}

export async function recusarSolicitacaoVenda(id, dados = {}) {
  return apiPost(`/vendas/aprovacoes/${id}/recusar`, dados);
}

export async function atualizarStatusVenda(id, dados) {
  return apiRequest(`/vendas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });
}

export async function deletarVenda(id) {
  return apiDelete(`/vendas/${id}`);
}

export async function buscarProblemaAtivoVenda(id) {
  return apiGet(`/vendas/${id}/problemas/ativo`);
}

export async function listarProblemasVenda(id) {
  return apiGet(`/vendas/${id}/problemas`);
}

export async function listarDestinatariosProblemaVenda() {
  return apiGet('/vendas/problemas/destinatarios');
}

export async function marcarProblemaVenda(id, dados) {
  return apiPost(`/vendas/${id}/problemas`, dados);
}

export async function resolverProblemaVenda(problemaId, dados) {
  return apiPost(`/vendas/problemas/${problemaId}/resolver`, dados);
}

export async function solicitarCorrecaoProblemaVenda(problemaId, dados) {
  return apiPost(`/vendas/problemas/${problemaId}/correcao`, dados);
}

export async function verificarProblemaVenda(problemaId) {
  return apiPost(`/vendas/problemas/${problemaId}/verificar`, {});
}

export async function restaurarVenda(id) {
  return apiPost(`/vendas/${id}/restaurar`, {});
}

export async function deletarVendaDefinitivo(id) {
  return apiDelete(`/vendas/${id}/definitivo`);
}

export async function listarVendedoras() {
  return apiGet('/vendas/vendedoras');
}
