import { apiGet } from './api';

export class CnpjConsultaError extends Error {
  constructor(message, code = 'erro') {
    super(message);
    this.name = 'CnpjConsultaError';
    this.code = code;
  }
}

export function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

export function isCnpjRepetido(cnpj) {
  return /^(\d)\1{13}$/.test(cnpj);
}

export function validarCnpjParaConsulta(valor) {
  const cnpj = sanitizarCnpj(valor);

  if (cnpj.length !== 14) {
    throw new CnpjConsultaError('Informe um CNPJ com 14 dígitos.', 'cnpj_incompleto');
  }

  if (isCnpjRepetido(cnpj)) {
    throw new CnpjConsultaError('CNPJ inválido.', 'cnpj_invalido');
  }

  return cnpj;
}

export async function consultarCnpj(valor) {
  const cnpj = validarCnpjParaConsulta(valor);
  return apiGet(`/cnpj/${cnpj}`);
}
