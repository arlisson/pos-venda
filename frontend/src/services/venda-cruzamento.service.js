import { apiRequest } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Monta o FormData com as tres planilhas do cruzamento.
 *
 * @param {{ principal: File, claro: File, vivo: File }} arquivos - Arquivos selecionados.
 * @param {Object} [extra] - Campos de texto adicionais (ex.: config).
 * @returns {FormData}
 */
function montarFormData({ principal, claro, vivo }, extra = {}) {
  const formData = new FormData();
  formData.append('principal', principal);
  formData.append('claro', claro);
  formData.append('vivo', vivo);
  Object.entries(extra).forEach(([chave, valor]) => formData.append(chave, valor));
  return formData;
}

/**
 * Baixa um blob para o usuario disparando o download no navegador.
 *
 * @param {Blob} blob - Conteudo binario.
 * @param {string} nomeArquivo - Nome sugerido para o arquivo.
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
 * Gera a pre-visualizacao das tres planilhas para configuracao do mapeamento.
 *
 * @param {{ principal: File, claro: File, vivo: File }} arquivos - Arquivos selecionados.
 * @returns {Promise<Object>} Preview por planilha (colunas, amostras, valoresDistintos) + sugestoes.
 */
export function previewCruzamento(arquivos) {
  return apiRequest('/vendas/cruzamento/preview', {
    method: 'POST',
    body: montarFormData(arquivos)
  });
}

/**
 * Processa o cruzamento e dispara o download do cruzamento.xlsx.
 *
 * Usa fetch direto (em vez de apiBlob) porque o corpo e multipart/form-data:
 * definir Content-Type manualmente quebraria o boundary do FormData.
 *
 * @param {{ principal: File, claro: File, vivo: File, config: Object }} dados - Arquivos + config.
 * @returns {Promise<void>}
 */
export async function processarCruzamento({ principal, claro, vivo, config }) {
  const token = localStorage.getItem('token');
  const body = montarFormData({ principal, claro, vivo }, { config: JSON.stringify(config) });

  const response = await fetch(`${API_URL}/vendas/cruzamento/processar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await response.json() : null;
    throw new Error(data?.message || data?.error || 'Erro ao gerar o cruzamento.');
  }

  const blob = await response.blob();
  const dataArquivo = new Date().toISOString().slice(0, 10);
  baixarBlob(blob, `cruzamento-${dataArquivo}.xlsx`);
}
