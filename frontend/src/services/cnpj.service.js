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

export function validarDigitosCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || isCnpjRepetido(cnpj)) return false;

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

export async function consultarCnpj(valor) {
  const cnpj = validarCnpjParaConsulta(valor);
  return apiGet(`/cnpj/${cnpj}`);
}
