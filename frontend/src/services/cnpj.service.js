/**
 * Utilitarios e cliente de API para CPF/CNPJ.
 */
import { apiBlob, apiDelete, apiGet, apiPost, apiRequest, apiStreamNdjson } from './api';

/**
 * Sanitiza cpf removendo caracteres nao esperados.
 */
export function sanitizarCpf(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Formata cpf para exibicao ou envio.
 */
export function formatarCpf(valor) {
  const d = sanitizarCpf(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Valida digitos cpf e retorna o resultado esperado.
 */
export function validarDigitosCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  /**
   * Calcula o digito ou valor auxiliar usado na validacao.
   */
  const calc = (n) => {
    const soma = Array.from({ length: n }, (_, i) => Number(cpf[i]) * (n + 1 - i)).reduce((a, b) => a + b, 0);
    const r = (soma * 10) % 11;
    return r >= 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export class CnpjConsultaError extends Error {
  constructor(message, code = 'erro') {
    super(message);
    this.name = 'CnpjConsultaError';
    this.code = code;
  }
}

/**
 * Sanitiza cnpj removendo caracteres nao esperados.
 */
export function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

/**
 * Verifica se cnpj repetido atende a condicao esperada.
 */
export function isCnpjRepetido(cnpj) {
  return /^(\d)\1{13}$/.test(cnpj);
}

/**
 * Valida digitos cnpj e retorna o resultado esperado.
 */
export function validarDigitosCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || isCnpjRepetido(cnpj)) return false;

  /**
   * Calcula digito com base nos valores informados.
   */
  const calcularDigito = (base) => {
    const pesos = base === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((total, peso, index) => total + Number(cnpj[index]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcularDigito(12) === Number(cnpj[12]) && calcularDigito(13) === Number(cnpj[13]);
}

/**
 * Valida cnpj para consulta e retorna o resultado esperado.
 */
export function validarCnpjParaConsulta(valor) {
  const cnpj = sanitizarCnpj(valor);

  if (cnpj.length !== 14) {
    throw new CnpjConsultaError('Informe um CNPJ com 14 dígitos.', 'cnpj_incompleto');
  }

  if (!validarDigitosCnpj(cnpj)) {
    throw new CnpjConsultaError('CNPJ inválido.', 'cnpj_invalido');
  }

  return cnpj;
}

/**
 * Consulta cnpj na fonte configurada.
 */
export async function consultarCnpj(valor) {
  const cnpj = validarCnpjParaConsulta(valor);
  return apiGet(`/cnpj/${cnpj}`);
}

export async function listarGooglePlacesKeys() {
  return apiGet('/cnpj/google-places/keys');
}

export async function adicionarGooglePlacesKey(dados) {
  return apiPost('/cnpj/google-places/keys', dados);
}

export async function removerGooglePlacesKey(id) {
  return apiDelete(`/cnpj/google-places/keys/${id}`);
}

function montarFormDataPlanilha(arquivo, mapeamento) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (mapeamento) {
    formData.append('mapeamento', JSON.stringify(mapeamento));
  }
  return formData;
}

export async function previewPlanilhaCnpj(arquivo) {
  return apiRequest('/cnpj/planilha/preview', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo)
  });
}

export async function consultarPlanilhaCnpj(arquivo, mapeamento) {
  return apiRequest('/cnpj/planilha/consultar', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo, mapeamento)
  });
}

export async function consultarPlanilhaCnpjStream(arquivo, mapeamento, onEvent, opcoes = {}) {
  return apiStreamNdjson('/cnpj/planilha/consultar-stream', {
    method: 'POST',
    body: montarFormDataPlanilha(arquivo, mapeamento),
    signal: opcoes.signal
  }, onEvent);
}

export async function adicionarClientesCnpj(linhas) {
  return apiPost('/cnpj/planilha/clientes', { linhas });
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

export async function exportarResultadoCnpj(linhas, nome = '') {
  const blob = await apiBlob('/cnpj/planilha/exportar', {
    method: 'POST',
    body: JSON.stringify({ linhas, nome })
  });
  const data = new Date().toISOString().slice(0, 10);
  baixarBlob(blob, `consulta-cnpj-${data}.xlsx`);
}
