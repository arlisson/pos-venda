import { apiBlob, apiDelete, apiGet, apiPost, apiPut } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (Array.isArray(valor) && valor.length > 0) {
      params.set(chave, valor.join(','));
    } else if (valor !== undefined && valor !== null && valor !== '') {
      params.set(chave, valor);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listarLeadPlanilhas() {
  return apiGet('/lead-planilhas');
}

export function criarLeadPlanilha(dados) {
  return apiPost('/lead-planilhas', dados);
}

export function uploadLeadPlanilha(file, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/lead-planilhas/uploads`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Resposta inválida do servidor.')); }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data?.message || data?.error || 'Erro no upload.'));
        } catch { reject(new Error('Erro no upload.')); }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Erro de rede no upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelado.')));

    xhr.send(formData);
  });
}

export function buscarLeadPlanilhaStatus(id) {
  return apiGet(`/lead-planilhas/${id}/status`);
}

export function salvarLeadLinhas(planilhaId, linhas) {
  return apiPost(`/lead-planilhas/${planilhaId}/linhas`, { linhas });
}

export function finalizarLeadPlanilha(planilhaId, dados = {}) {
  return apiPost(`/lead-planilhas/${planilhaId}/finalizar`, dados);
}

export function marcarErroLeadPlanilha(planilhaId, message) {
  return apiPost(`/lead-planilhas/${planilhaId}/erro`, { message });
}

export function atualizarLeadSchema(planilhaId, schema_colunas) {
  return apiPut(`/lead-planilhas/${planilhaId}/schema`, { schema_colunas });
}

export function excluirLeadPlanilha(planilhaId) {
  return apiDelete(`/lead-planilhas/${planilhaId}`);
}

export function listarLeadLinhas(filtros = {}) {
  return apiGet(`/lead-planilhas/linhas${montarQuery(filtros)}`);
}

export function exportarLeadLinhas(dados = {}) {
  return apiBlob('/lead-planilhas/exportar', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
}

export function dividirLeadLinhas(dados) {
  return apiPost('/lead-planilhas/dividir', dados);
}

export function listarLeadEnvios() {
  return apiGet('/lead-planilhas/envios');
}

export function listarMeusLeadEnvios() {
  return apiGet('/lead-planilhas/me/envios');
}

export function listarMinhasLeadLinhas(filtros = {}) {
  return apiGet(`/lead-planilhas/me/linhas${montarQuery(filtros)}`);
}

export function exportarMinhasLeadLinhas(dados = {}) {
  return apiBlob('/lead-planilhas/me/exportar', {
    method: 'POST',
    body: JSON.stringify(dados)
  });
}

export function atualizarCampoLeadRecebido(linhaId, dados) {
  return apiPut(`/lead-planilhas/me/linhas/${linhaId}/campo-atualizado`, dados);
}

export function marcarFuturoClienteLead(linhaId, dados) {
  return apiPost(`/lead-planilhas/me/linhas/${linhaId}/futuro-cliente`, dados);
}

export function listarFuturosClientesLeads(filtros = {}) {
  return apiGet(`/lead-planilhas/me/futuros-clientes${montarQuery(filtros)}`);
}

export function listarFuturosClientesLixeira(filtros = {}) {
  return apiGet(`/lead-planilhas/me/futuros-clientes/lixeira${montarQuery(filtros)}`);
}

export function excluirFuturoCliente(linhaId) {
  return apiDelete(`/lead-planilhas/me/futuros-clientes/${linhaId}`);
}

export function restaurarFuturoCliente(linhaId) {
  return apiPost(`/lead-planilhas/me/futuros-clientes/${linhaId}/restaurar`, {});
}

export function excluirFuturoClienteDefinitivo(linhaId) {
  return apiDelete(`/lead-planilhas/me/futuros-clientes/${linhaId}/definitivo`);
}
