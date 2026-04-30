const LeadPlanilha = require('../models/LeadPlanilha');
const LeadLinha = require('../models/LeadLinha');
const LeadEnvio = require('../models/LeadEnvio');
const LeadEnvioUsuario = require('../models/LeadEnvioUsuario');

function parseJson(valor, fallback) {
  if (valor === null || valor === undefined) return fallback;
  if (typeof valor !== 'string') return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
}

function formatarPlanilha(planilha) {
  const json = typeof planilha?.toJSON === 'function' ? planilha.toJSON() : planilha;
  if (!json) return json;

  return {
    ...json,
    colunas: parseJson(json.colunas, []),
    schema_colunas: parseJson(json.schema_colunas, {})
  };
}

function formatarEnvio(envio) {
  const json = typeof envio?.toJSON === 'function' ? envio.toJSON() : envio;
  if (!json) return json;

  return {
    ...json,
    colunas_visiveis: parseJson(json.colunas_visiveis, []),
    usuarios: (json.usuarios || []).map(item => ({
      ...item,
      usuario: item.usuario
    }))
  };
}

function formatarLinha(linha) {
  const json = typeof linha?.toJSON === 'function' ? linha.toJSON() : linha;
  if (!json) return json;

  return {
    ...json,
    dados_json: parseJson(json.dados_json, {}),
    planilha: formatarPlanilha(json.planilha),
    envio: formatarEnvio(json.envio)
  };
}

async function listarPlanilhas() {
  const planilhas = await LeadPlanilha.query()
    .withGraphFetched('criador')
    .modifyGraph('criador', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  return planilhas.map(formatarPlanilha);
}

async function criarPlanilha(dados, usuarioId) {
  const colunas = Array.isArray(dados.colunas) ? dados.colunas : [];
  const schemaColunas = dados.schema_colunas && typeof dados.schema_colunas === 'object'
    ? dados.schema_colunas
    : {};

  if (!String(dados.nome || '').trim()) {
    throw new Error('Informe o nome da planilha.');
  }

  if (colunas.length === 0) {
    throw new Error('A planilha precisa ter ao menos uma coluna.');
  }

  const planilha = await LeadPlanilha.query().insertAndFetch({
    nome: String(dados.nome).trim(),
    colunas: JSON.stringify(colunas),
    schema_colunas: JSON.stringify(schemaColunas),
    total_linhas: Number(dados.total_linhas || 0),
    criado_por_id: usuarioId
  });

  return formatarPlanilha(planilha);
}

async function salvarLinhasLote(planilhaId, linhas = []) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);

  if (!planilha) {
    throw new Error('Planilha nao encontrada.');
  }

  const payload = linhas.map((linha, index) => ({
    planilha_id: Number(planilhaId),
    row_index: Number(linha.row_index ?? index),
    dados_json: JSON.stringify(linha.dados_json || linha.dados || {})
  }));

  if (payload.length > 0) {
    await LeadLinha.knex().batchInsert('lead_linhas', payload, 1000);
  }

  const total = await LeadLinha.query()
    .where('planilha_id', planilhaId)
    .resultSize();

  await LeadPlanilha.query().patchAndFetchById(planilhaId, {
    total_linhas: total,
    updated_at: new Date()
  });

  return { total_linhas: total };
}

async function atualizarSchema(planilhaId, schemaColunas) {
  const planilha = await LeadPlanilha.query().patchAndFetchById(planilhaId, {
    schema_colunas: JSON.stringify(schemaColunas || {}),
    updated_at: new Date()
  });

  if (!planilha) {
    return null;
  }

  return formatarPlanilha(planilha);
}

function idsFromQuery(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map(Number).filter(Boolean);
  return String(valor)
    .split(',')
    .map(item => Number(item.trim()))
    .filter(Boolean);
}

async function listarLinhas(filtros = {}, opcoes = {}) {
  const planilhaIds = idsFromQuery(filtros.planilha_ids);
  const envioIds = idsFromQuery(filtros.envio_ids);
  const query = LeadLinha.query()
    .withGraphFetched('[planilha, envio, atribuidoPara]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'))
    .orderBy('planilha_id', 'asc')
    .orderBy('row_index', 'asc');

  if (planilhaIds.length > 0) {
    query.whereIn('planilha_id', planilhaIds);
  }

  if (envioIds.length > 0) {
    query.whereIn('envio_id', envioIds);
  }

  if (opcoes.usuarioId) {
    query.where('atribuido_para_id', Number(opcoes.usuarioId));
  }

  return (await query).map(formatarLinha);
}

async function listarEnviosDoUsuario(usuarioId) {
  const envios = await LeadEnvio.query()
    .whereExists(
      LeadEnvioUsuario.query()
        .select(1)
        .whereRaw('lead_envio_usuarios.envio_id = lead_envios.id')
        .where('lead_envio_usuarios.usuario_id', usuarioId)
    )
    .withGraphFetched('usuarios.usuario')
    .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  return envios.map(formatarEnvio);
}

async function listarTodosEnvios() {
  const envios = await LeadEnvio.query()
    .withGraphFetched('usuarios.usuario')
    .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  return envios.map(formatarEnvio);
}

function montarAlocacoes(usuarioIds, quantidadeTotal, alocacaoManual = {}) {
  const base = Math.floor(quantidadeTotal / usuarioIds.length);
  const sobra = quantidadeTotal % usuarioIds.length;

  if (sobra > 0) {
    const totalManual = Object.values(alocacaoManual)
      .reduce((acc, valor) => acc + Number(valor || 0), 0);

    if (totalManual !== sobra) {
      return {
        pendente: true,
        sobra,
        base,
        alocacoes: usuarioIds.reduce((acc, id) => ({ ...acc, [id]: base }), {})
      };
    }
  }

  return {
    pendente: false,
    sobra,
    base,
    alocacoes: usuarioIds.reduce((acc, id) => ({
      ...acc,
      [id]: base + Number(alocacaoManual[id] || 0)
    }), {})
  };
}

async function dividirLeads(dados, usuarioId) {
  const linhaIds = Array.isArray(dados.linha_ids)
    ? dados.linha_ids.map(Number).filter(Boolean)
    : [];
  const usuarioIds = Array.isArray(dados.usuario_ids)
    ? dados.usuario_ids.map(Number).filter(Boolean)
    : [];
  const quantidadeTotal = Number(dados.quantidade_total || 0);

  if (!String(dados.nome || '').trim()) {
    throw new Error('Informe um nome para o envio.');
  }

  if (linhaIds.length === 0) {
    throw new Error('Selecione ao menos um lead.');
  }

  if (usuarioIds.length === 0) {
    throw new Error('Selecione ao menos um vendedor.');
  }

  if (quantidadeTotal <= 0 || quantidadeTotal > linhaIds.length) {
    throw new Error('Quantidade de clientes invalida para a selecao atual.');
  }

  const alocacao = montarAlocacoes(usuarioIds, quantidadeTotal, dados.alocacao_manual || {});

  if (alocacao.pendente) {
    return {
      requires_manual_allocation: true,
      sobra: alocacao.sobra,
      base: alocacao.base,
      alocacoes: alocacao.alocacoes
    };
  }

  const linhasSelecionadas = await LeadLinha.query()
    .whereIn('id', linhaIds)
    .orderByRaw(`FIELD(id, ${linhaIds.map(() => '?').join(',')})`, linhaIds)
    .limit(quantidadeTotal);

  return LeadEnvio.transaction(async trx => {
    const envio = await LeadEnvio.query(trx).insertAndFetch({
      nome: String(dados.nome).trim(),
      total_linhas: quantidadeTotal,
      colunas_visiveis: JSON.stringify(dados.colunas_visiveis || []),
      criado_por_id: usuarioId
    });

    let cursor = 0;

    for (const usuarioAlvoId of usuarioIds) {
      const quantidade = Number(alocacao.alocacoes[usuarioAlvoId] || 0);
      const linhasUsuario = linhasSelecionadas.slice(cursor, cursor + quantidade);
      cursor += quantidade;

      await LeadEnvioUsuario.query(trx).insert({
        envio_id: envio.id,
        usuario_id: usuarioAlvoId,
        quantidade
      });

      if (linhasUsuario.length > 0) {
        await LeadLinha.query(trx)
          .whereIn('id', linhasUsuario.map(linha => linha.id))
          .patch({
            atribuido_para_id: usuarioAlvoId,
            envio_id: envio.id,
            updated_at: new Date()
          });
      }
    }

    const envioCompleto = await LeadEnvio.query(trx)
      .findById(envio.id)
      .withGraphFetched('usuarios.usuario')
      .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'));

    return {
      requires_manual_allocation: false,
      envio: formatarEnvio(envioCompleto)
    };
  });
}

module.exports = {
  listarPlanilhas,
  criarPlanilha,
  salvarLinhasLote,
  atualizarSchema,
  listarLinhas,
  listarEnviosDoUsuario,
  listarTodosEnvios,
  dividirLeads
};
