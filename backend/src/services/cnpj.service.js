const axios = require('axios');
const db = require('../database/connection');

const CNPJ_TIMEOUT_MS = 5000;
const CACHE_DIAS = 30;
const FONTES = ['BrasilAPI', 'CNPJa', 'CNPJws'];

class CnpjConsultaError extends Error {
  constructor(message, code = 'erro') {
    super(message);
    this.name = 'CnpjConsultaError';
    this.code = code;
  }
}

function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function isCnpjRepetido(cnpj) {
  return /^(\d)\1{13}$/.test(cnpj);
}

function validarCnpj(valor) {
  const cnpj = sanitizarCnpj(valor);

  if (cnpj.length !== 14) {
    throw new CnpjConsultaError('Informe um CNPJ com 14 digitos.', 'cnpj_incompleto');
  }

  if (isCnpjRepetido(cnpj)) {
    throw new CnpjConsultaError('CNPJ invalido.', 'cnpj_invalido');
  }

  return cnpj;
}

function parseJsonSeguro(valor, fallback) {
  if (!valor) return fallback;
  if (typeof valor !== 'string') return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate())
  ].join('-') + ' ' + [
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds())
  ].join(':');
}

function adicionarDias(data, dias) {
  const proxima = new Date(data);
  proxima.setDate(proxima.getDate() + dias);
  return proxima;
}

function normalizarTelefone(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

function primeiroValor(...valores) {
  return valores.find(valor => String(valor || '').trim()) || '';
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function criarPayloadVazio() {
  return {
    razaoSocial: '',
    nomeFantasia: '',
    email: '',
    telefone: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
    fonte: ''
  };
}

function contarCamposPreenchidos(payload) {
  return Object.entries(payload)
    .filter(([campo, valor]) => campo !== 'fonte' && String(valor || '').trim())
    .map(([campo]) => campo);
}

function normalizarBrasilApi(data) {
  return {
    razaoSocial: normalizarTexto(data.razao_social),
    nomeFantasia: normalizarTexto(data.nome_fantasia),
    email: normalizarTexto(data.email),
    telefone: normalizarTelefone(data.ddd_telefone_1),
    cep: normalizarTexto(data.cep),
    endereco: normalizarTexto(data.logradouro),
    numero: normalizarTexto(data.numero),
    complemento: normalizarTexto(data.complemento),
    bairro: normalizarTexto(data.bairro),
    municipio: normalizarTexto(data.municipio),
    uf: normalizarTexto(data.uf).toUpperCase(),
    fonte: 'BrasilAPI'
  };
}

function normalizarCnpja(data) {
  const telefone = Array.isArray(data.phones) ? data.phones[0] : null;
  const email = Array.isArray(data.emails) ? data.emails[0] : null;
  const address = data.address || {};

  return {
    razaoSocial: normalizarTexto(data.company?.name),
    nomeFantasia: normalizarTexto(data.alias),
    email: normalizarTexto(email?.address),
    telefone: normalizarTelefone(primeiroValor(
      telefone?.number && telefone?.area ? `${telefone.area}${telefone.number}` : '',
      telefone?.number
    )),
    cep: normalizarTexto(address.zip),
    endereco: normalizarTexto(address.street),
    numero: normalizarTexto(address.number),
    complemento: normalizarTexto(address.details),
    bairro: normalizarTexto(address.district),
    municipio: normalizarTexto(typeof address.city === 'string' ? address.city : address.city?.name),
    uf: normalizarTexto(address.state).toUpperCase(),
    fonte: 'CNPJa'
  };
}

function normalizarCnpjws(data) {
  const estabelecimento = data.estabelecimento || {};
  const cidade = estabelecimento.cidade || {};
  const estado = estabelecimento.estado || {};

  return {
    razaoSocial: normalizarTexto(data.razao_social),
    nomeFantasia: normalizarTexto(estabelecimento.nome_fantasia),
    email: normalizarTexto(estabelecimento.email),
    telefone: normalizarTelefone(primeiroValor(
      estabelecimento.ddd1 && estabelecimento.telefone1 ? `${estabelecimento.ddd1}${estabelecimento.telefone1}` : '',
      estabelecimento.telefone1
    )),
    cep: normalizarTexto(estabelecimento.cep),
    endereco: normalizarTexto([
      estabelecimento.tipo_logradouro,
      estabelecimento.logradouro
    ].filter(Boolean).join(' ')),
    numero: normalizarTexto(estabelecimento.numero),
    complemento: normalizarTexto(estabelecimento.complemento),
    bairro: normalizarTexto(estabelecimento.bairro),
    municipio: normalizarTexto(cidade.nome),
    uf: normalizarTexto(estado.sigla).toUpperCase(),
    fonte: 'CNPJws'
  };
}

function getAxiosErrorCode(error) {
  const status = error.response?.status;
  if (status === 404) return 'nao_encontrado';
  if (status === 429) return 'limite';
  if (error.code === 'ECONNABORTED') return 'timeout';
  return 'erro';
}

async function consultarFonte(fonte, url, normalizar) {
  try {
    const response = await axios.get(url, {
      timeout: CNPJ_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'pos-venda-cnpj-aggregator/1.0'
      }
    });

    return {
      fonte,
      ok: true,
      normalizado: normalizar(response.data),
      resumo: resumirPayloadBruto(fonte, response.data)
    };
  } catch (error) {
    return {
      fonte,
      ok: false,
      code: getAxiosErrorCode(error),
      status: error.response?.status || null,
      message: error.response?.data?.message || error.response?.data?.erro || error.message
    };
  }
}

function resumirPayloadBruto(fonte, data) {
  if (fonte === 'BrasilAPI') {
    return {
      cnpj: data.cnpj,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      cep: data.cep,
      municipio: data.municipio,
      uf: data.uf
    };
  }

  if (fonte === 'CNPJa') {
    return {
      taxId: data.taxId,
      alias: data.alias,
      company: data.company?.name,
      address: data.address
    };
  }

  return {
    cnpj_raiz: data.cnpj_raiz,
    razao_social: data.razao_social,
    estabelecimento: {
      cnpj: data.estabelecimento?.cnpj,
      nome_fantasia: data.estabelecimento?.nome_fantasia,
      cep: data.estabelecimento?.cep,
      cidade: data.estabelecimento?.cidade?.nome,
      estado: data.estabelecimento?.estado?.sigla
    }
  };
}

function combinarResultados(resultados) {
  const combinado = criarPayloadVazio();
  const fontesComSucesso = [];
  const fontesPorCampo = {};

  resultados
    .filter(resultado => resultado.ok)
    .forEach(resultado => {
      fontesComSucesso.push(resultado.fonte);

      Object.entries(resultado.normalizado || {}).forEach(([campo, valor]) => {
        if (campo === 'fonte') return;
        if (!String(valor || '').trim() || String(combinado[campo] || '').trim()) return;

        combinado[campo] = valor;
        fontesPorCampo[campo] = resultado.fonte;
      });
    });

  combinado.fonte = fontesComSucesso.join(' + ');

  return {
    ...combinado,
    fontesConsultadas: FONTES,
    fontesComSucesso,
    fontesPorCampo,
    camposPreenchidos: contarCamposPreenchidos(combinado),
    cache: false
  };
}

async function buscarCache(cnpj) {
  const agora = formatarDateTimeSQL();
  const registro = await db('cnpj_consultas_cache')
    .where({ cnpj })
    .where('expira_em', '>', agora)
    .first();

  if (!registro) return null;

  return {
    ...parseJsonSeguro(registro.payload_normalizado, {}),
    cache: true,
    cacheCriadoEm: registro.created_at,
    cacheExpiraEm: registro.expira_em
  };
}

async function salvarCache(cnpj, payload, resultados) {
  const agora = new Date();
  const registro = {
    cnpj,
    payload_normalizado: JSON.stringify(payload),
    payload_bruto_resumido: JSON.stringify(resultados.map(resultado => ({
      fonte: resultado.fonte,
      ok: resultado.ok,
      code: resultado.code,
      status: resultado.status,
      resumo: resultado.resumo
    }))),
    fontes: JSON.stringify(payload.fontesComSucesso || []),
    expira_em: formatarDateTimeSQL(adicionarDias(agora, CACHE_DIAS)),
    updated_at: formatarDateTimeSQL(agora)
  };

  await db('cnpj_consultas_cache')
    .insert({
      ...registro,
      created_at: formatarDateTimeSQL(agora)
    })
    .onConflict('cnpj')
    .merge(registro);
}

async function consultarCnpj(valor) {
  const cnpj = validarCnpj(valor);
  const cache = await buscarCache(cnpj);

  if (cache) return cache;

  const resultados = await Promise.all([
    consultarFonte('BrasilAPI', `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, normalizarBrasilApi),
    consultarFonte('CNPJa', `https://open.cnpja.com/office/${cnpj}`, normalizarCnpja),
    consultarFonte('CNPJws', `https://publica.cnpj.ws/cnpj/${cnpj}`, normalizarCnpjws)
  ]);

  const payload = combinarResultados(resultados);

  if (payload.fontesComSucesso.length === 0 || payload.camposPreenchidos.length === 0) {
    const teveLimite = resultados.some(resultado => resultado.code === 'limite');
    const teveNaoEncontrado = resultados.some(resultado => resultado.code === 'nao_encontrado');

    if (teveLimite) {
      throw new CnpjConsultaError('Limite de consultas atingido nas fontes publicas. Tente novamente em instantes.', 'limite');
    }

    if (teveNaoEncontrado) {
      throw new CnpjConsultaError('CNPJ nao encontrado nas fontes consultadas.', 'nao_encontrado');
    }

    throw new CnpjConsultaError('Nao foi possivel consultar o CNPJ agora. Tente novamente.', 'indisponivel');
  }

  await salvarCache(cnpj, payload, resultados);
  return payload;
}

module.exports = {
  CnpjConsultaError,
  consultarCnpj,
  sanitizarCnpj,
  validarCnpj
};
