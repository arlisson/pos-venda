const axios = require('axios');
const db = require('../database/connection');

const CNPJ_TIMEOUT_MS = 5000;
const CACHE_DIAS = 30;
const FONTES = ['BrasilAPI', 'CNPJa', 'CNPJws'];
const CAMPOS_CRITICOS = [
  'razaoSocial',
  'nomeFantasia',
  'situacaoCadastral',
  'cep',
  'endereco',
  'numero',
  'bairro',
  'municipio',
  'uf'
];
const LIMITE_CONFIANCA_ALTA_DIAS = 90;
const LIMITE_CONFIANCA_MEDIA_DIAS = 180;

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

function validarDigitosCnpj(cnpj) {
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

function validarCnpj(valor) {
  const cnpj = sanitizarCnpj(valor);

  if (cnpj.length !== 14) {
    throw new CnpjConsultaError('Informe um CNPJ com 14 digitos.', 'cnpj_incompleto');
  }

  if (!validarDigitosCnpj(cnpj)) {
    throw new CnpjConsultaError('CNPJ inválido.', 'cnpj_invalido');
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
    situacaoCadastral: '',
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
    situacaoCadastral: normalizarTexto(data.descricao_situacao_cadastral || data.situacao_cadastral),
    email: normalizarTexto(data.email),
    telefone: normalizarTelefone(data.ddd_telefone_1),
    cep: normalizarTexto(data.cep),
    endereco: normalizarTexto(data.logradouro),
    numero: normalizarTexto(data.numero),
    complemento: normalizarTexto(data.complemento),
    bairro: normalizarTexto(data.bairro),
    municipio: normalizarTexto(data.municipio),
    uf: normalizarTexto(data.uf).toUpperCase(),
    fonte: 'BrasilAPI',
    atualizadoEm: null
  };
}

function normalizarCnpja(data) {
  const telefone = Array.isArray(data.phones) ? data.phones[0] : null;
  const email = Array.isArray(data.emails) ? data.emails[0] : null;
  const address = data.address || {};

  return {
    razaoSocial: normalizarTexto(data.company?.name),
    nomeFantasia: normalizarTexto(data.alias),
    situacaoCadastral: normalizarTexto(data.status?.text || data.status?.description || data.status),
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
    fonte: 'CNPJa',
    atualizadoEm: normalizarTexto(data.updated)
  };
}

function normalizarCnpjws(data) {
  const estabelecimento = data.estabelecimento || {};
  const cidade = estabelecimento.cidade || {};
  const estado = estabelecimento.estado || {};

  return {
    razaoSocial: normalizarTexto(data.razao_social),
    nomeFantasia: normalizarTexto(estabelecimento.nome_fantasia),
    situacaoCadastral: normalizarTexto(estabelecimento.situacao_cadastral),
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
    fonte: 'CNPJws',
    atualizadoEm: normalizarTexto(data.atualizado_em || estabelecimento.atualizado_em)
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
      situacao_cadastral: data.descricao_situacao_cadastral || data.situacao_cadastral,
      cep: data.cep,
      municipio: data.municipio,
      uf: data.uf
    };
  }

  if (fonte === 'CNPJa') {
    return {
      taxId: data.taxId,
      alias: data.alias,
      updated: data.updated,
      company: data.company?.name,
      address: data.address
    };
  }

  return {
    cnpj_raiz: data.cnpj_raiz,
    razao_social: data.razao_social,
    atualizado_em: data.atualizado_em,
    estabelecimento: {
      cnpj: data.estabelecimento?.cnpj,
      nome_fantasia: data.estabelecimento?.nome_fantasia,
      atualizado_em: data.estabelecimento?.atualizado_em,
      situacao_cadastral: data.estabelecimento?.situacao_cadastral,
      cep: data.estabelecimento?.cep,
      cidade: data.estabelecimento?.cidade?.nome,
      estado: data.estabelecimento?.estado?.sigla
    }
  };
}

function dataParaIso(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString();
}

function diasDesde(valor, referencia = new Date()) {
  const iso = dataParaIso(valor);
  if (!iso) return null;
  return Math.floor((referencia.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function normalizarParaComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function calcularConfianca(atualizadoEm, divergente, referencia = new Date()) {
  if (divergente) return 'baixa';

  const idade = diasDesde(atualizadoEm, referencia);
  if (idade === null) return 'media';
  if (idade <= LIMITE_CONFIANCA_ALTA_DIAS) return 'alta';
  if (idade <= LIMITE_CONFIANCA_MEDIA_DIAS) return 'media';
  return 'baixa';
}

function combinarResultados(resultados) {
  const combinado = criarPayloadVazio();
  const fontesComSucesso = [];
  const fontesComErro = resultados
    .filter(resultado => !resultado.ok)
    .map(resultado => ({
      fonte: resultado.fonte,
      code: resultado.code || 'erro',
      status: resultado.status || null,
      message: resultado.message || ''
    }));
  const fontesPorCampo = {};
  const alternativasPorCampo = {};
  const alertas = [];
  const referencia = new Date();

  resultados
    .filter(resultado => resultado.ok)
    .forEach(resultado => {
      fontesComSucesso.push(resultado.fonte);

      Object.entries(resultado.normalizado || {}).forEach(([campo, valor]) => {
        if (campo === 'fonte' || campo === 'atualizadoEm') return;
        if (!String(valor || '').trim()) return;

        alternativasPorCampo[campo] = alternativasPorCampo[campo] || [];
        alternativasPorCampo[campo].push({
          fonte: resultado.fonte,
          valor,
          atualizadoEm: dataParaIso(resultado.normalizado.atualizadoEm)
        });

        if (String(combinado[campo] || '').trim()) return;

        combinado[campo] = valor;
        fontesPorCampo[campo] = {
          fonte: resultado.fonte,
          atualizadoEm: dataParaIso(resultado.normalizado.atualizadoEm),
          confianca: 'media',
          divergente: false
        };
      });
    });

  Object.entries(alternativasPorCampo).forEach(([campo, alternativas]) => {
    const valoresDistintos = new Set(alternativas.map(item => normalizarParaComparacao(item.valor)).filter(Boolean));
    const divergente = CAMPOS_CRITICOS.includes(campo) && valoresDistintos.size > 1;

    if (fontesPorCampo[campo]) {
      fontesPorCampo[campo].divergente = divergente;
      fontesPorCampo[campo].confianca = calcularConfianca(fontesPorCampo[campo].atualizadoEm, divergente, referencia);
    }

    if (divergente) {
      alertas.push({
        tipo: 'divergencia',
        campo,
        mensagem: `${campo} diverge entre fontes.`
      });
    }
  });

  Object.entries(fontesPorCampo).forEach(([campo, meta]) => {
    const idade = diasDesde(meta.atualizadoEm, referencia);
    if (idade !== null && idade > LIMITE_CONFIANCA_ALTA_DIAS) {
      alertas.push({
        tipo: 'antiguidade',
        campo,
        mensagem: `${campo} foi atualizado na fonte ha ${idade} dias.`
      });
    }
  });

  combinado.fonte = fontesComSucesso.join(' + ');

  return {
    ...combinado,
    consultadoEm: referencia.toISOString(),
    fontesConsultadas: FONTES,
    fontesComSucesso,
    fontesComErro,
    fontesPorCampo,
    camposPreenchidos: contarCamposPreenchidos(combinado),
    alternativasPorCampo,
    alertas,
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

  return montarPayloadCache(registro);
}

function montarPayloadCache(registro) {
  const payload = parseJsonSeguro(registro.payload_normalizado, {});
  const fontesPorCampo = Object.fromEntries(
    Object.entries(payload.fontesPorCampo || {}).map(([campo, meta]) => [
      campo,
      typeof meta === 'string'
        ? { fonte: meta, atualizadoEm: null, confianca: 'media', divergente: false }
        : {
            fonte: meta?.fonte || '',
            atualizadoEm: meta?.atualizadoEm || null,
            confianca: meta?.confianca || 'media',
            divergente: Boolean(meta?.divergente)
          }
    ])
  );

  return {
    ...payload,
    consultadoEm: payload.consultadoEm || registro.updated_at || registro.created_at,
    fontesConsultadas: payload.fontesConsultadas || FONTES,
    fontesComSucesso: payload.fontesComSucesso || parseJsonSeguro(registro.fontes, []),
    fontesComErro: payload.fontesComErro || [],
    fontesPorCampo,
    alternativasPorCampo: payload.alternativasPorCampo || {},
    alertas: payload.alertas || [],
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
      throw new CnpjConsultaError('CNPJ não encontrado nas fontes consultadas.', 'nao_encontrado');
    }

    throw new CnpjConsultaError('Não foi possível consultar o CNPJ agora. Tente novamente.', 'indisponivel');
  }

  await salvarCache(cnpj, payload, resultados);
  return payload;
}

module.exports = {
  CnpjConsultaError,
  calcularConfianca,
  combinarResultados,
  consultarCnpj,
  montarPayloadCache,
  normalizarBrasilApi,
  normalizarCnpja,
  normalizarCnpjws,
  sanitizarCnpj,
  validarCnpj,
  validarDigitosCnpj
};
