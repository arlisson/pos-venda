/**
 * Utilitarios e cliente de API para CPF/CNPJ.
 */
import { apiGet } from './api';

/**
 * Executa a rotina sanitizar cpf.
 */
export function sanitizarCpf(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Executa a rotina formatar cpf.
 */
export function formatarCpf(valor) {
  const d = sanitizarCpf(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Executa a rotina validar digitos cpf.
 */
export function validarDigitosCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  /**
   * Executa a rotina calc.
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
 * Executa a rotina sanitizar cnpj.
 */
export function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

/**
 * Executa a rotina is cnpj repetido.
 */
export function isCnpjRepetido(cnpj) {
  return /^(\d)\1{13}$/.test(cnpj);
}

/**
 * Executa a rotina validar digitos cnpj.
 */
export function validarDigitosCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || isCnpjRepetido(cnpj)) return false;

  /**
   * Executa a rotina calcular digito.
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
 * Executa a rotina validar cnpj para consulta.
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
 * Executa a rotina consultar cnpj.
 */
export async function consultarCnpj(valor) {
  const cnpj = validarCnpjParaConsulta(valor);
  return apiGet(`/cnpj/${cnpj}`);
}
