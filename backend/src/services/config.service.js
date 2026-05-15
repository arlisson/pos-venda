const LinkExterno = require('../models/LinkExterno');
const Operadora = require('../models/Operadora');
const TipoProduto = require('../models/TipoProduto');
const TipoVenda = require('../models/TipoVenda');
const Servico = require('../models/Servico');
const FunilEtapa = require('../models/FunilEtapa');
const RegraComissao = require('../models/RegraComissao');
const Venda = require('../models/Venda');

function orderConfig(query) {
  return query.orderBy('nome', 'asc').orderBy('id', 'asc');
}

function selectConfig(query) {
  return query.select('id', 'nome', 'ativo', 'created_at', 'updated_at');
}

function ocultarOrdem(registro) {
  if (!registro) return registro;

  const json = typeof registro.toJSON === 'function' ? registro.toJSON() : registro;
  const { ordem, ...semOrdem } = json;

  return semOrdem;
}

async function listarOperadoras() {
  return orderConfig(selectConfig(Operadora.query()));
}

async function listarLinksExternos() {
  return LinkExterno.query()
    .select('id', 'chave', 'nome', 'url', 'dot', 'ativo', 'created_at', 'updated_at')
    .orderBy('nome', 'asc')
    .orderBy('id', 'asc');
}

async function listarTiposProduto() {
  return orderConfig(selectConfig(TipoProduto.query()));
}

async function listarTiposVenda() {
  return orderConfig(selectConfig(TipoVenda.query()));
}

async function listarServicos() {
  return orderConfig(selectConfig(Servico.query()));
}

async function listarFunilEtapas() {
  return FunilEtapa.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarRegrasComissao() {
  return RegraComissao.query()
    .alias('rc')
    .leftJoin('operadoras as o', 'rc.operadora_id', 'o.id')
    .select(
      'rc.id',
      'rc.operadora_id',
      'rc.valor_min',
      'rc.valor_max',
      'rc.valor_comissao',
      'rc.valor_comissao_base',
      'rc.valor_comissao_base_propria',
      'rc.prioridade_base_dupla',
      'rc.ativo',
      'rc.created_at',
      'rc.updated_at',
      'o.nome as operadora_nome'
    )
    .orderByRaw('rc.operadora_id IS NOT NULL DESC')
    .orderBy('o.nome', 'asc')
    .orderBy('rc.valor_min', 'asc')
    .orderBy('rc.valor_max', 'asc')
    .orderBy('rc.id', 'asc');
}

async function listarOperadorasAtivas() {
  return orderConfig(selectConfig(Operadora.query().where('ativo', true)));
}

async function listarTiposProdutoAtivos() {
  return orderConfig(selectConfig(TipoProduto.query().where('ativo', true)));
}

async function listarTiposVendaAtivos() {
  return orderConfig(selectConfig(TipoVenda.query().where('ativo', true)));
}

async function listarServicosAtivos() {
  return orderConfig(selectConfig(Servico.query().where('ativo', true)));
}

async function listarFunilEtapasAtivas() {
  return FunilEtapa.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarLinksExternosAtivos() {
  return LinkExterno.query()
    .where('ativo', true)
    .select('id', 'chave', 'nome', 'url', 'dot', 'ativo', 'created_at', 'updated_at')
    .orderBy('nome', 'asc')
    .orderBy('id', 'asc');
}

async function listarRegrasComissaoAtivas() {
  return RegraComissao.query()
    .alias('rc')
    .leftJoin('operadoras as o', 'rc.operadora_id', 'o.id')
    .select(
      'rc.id',
      'rc.operadora_id',
      'rc.valor_min',
      'rc.valor_max',
      'rc.valor_comissao',
      'rc.valor_comissao_base',
      'rc.valor_comissao_base_propria',
      'rc.prioridade_base_dupla',
      'rc.ativo',
      'rc.created_at',
      'rc.updated_at',
      'o.nome as operadora_nome'
    )
    .where('rc.ativo', true)
    .orderByRaw('rc.operadora_id IS NOT NULL DESC')
    .orderBy('o.nome', 'asc')
    .orderBy('rc.valor_min', 'asc')
    .orderBy('rc.valor_max', 'asc')
    .orderBy('rc.id', 'asc');
}

async function criarOperadora(dados) {
  const operadora = await Operadora.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true
  });

  return ocultarOrdem(operadora);
}

async function atualizarOperadora(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;

  const operadora = await Operadora.query().patchAndFetchById(id, atualizacao);
  return ocultarOrdem(operadora);
}

async function excluirOperadora(id) {
  return Operadora.query().deleteById(id);
}

async function criarTipoProduto(dados) {
  const tipoProduto = await TipoProduto.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true
  });

  return ocultarOrdem(tipoProduto);
}

async function atualizarTipoProduto(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;

  const tipoProduto = await TipoProduto.query().patchAndFetchById(id, atualizacao);
  return ocultarOrdem(tipoProduto);
}

async function excluirTipoProduto(id) {
  return TipoProduto.query().deleteById(id);
}

async function criarTipoVenda(dados) {
  const tipoVenda = await TipoVenda.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true
  });

  return ocultarOrdem(tipoVenda);
}

async function atualizarTipoVenda(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;

  const tipoVenda = await TipoVenda.query().patchAndFetchById(id, atualizacao);
  return ocultarOrdem(tipoVenda);
}

async function excluirTipoVenda(id) {
  return TipoVenda.query().deleteById(id);
}

async function criarServico(dados) {
  const servico = await Servico.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true
  });

  return ocultarOrdem(servico);
}

async function atualizarServico(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;

  const servico = await Servico.query().patchAndFetchById(id, atualizacao);
  return ocultarOrdem(servico);
}

async function excluirServico(id) {
  return Servico.query().deleteById(id);
}

function normalizarCodigoEtapa(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function criarFunilEtapa(dados) {
  const codigo = normalizarCodigoEtapa(dados.codigo || dados.nome);

  if (!codigo) {
    throw new Error('Informe um nome valido para a etapa.');
  }

  const etapaFinal = Boolean(dados.etapa_final);
  await validarEtapaFinalUnica(etapaFinal);

  return FunilEtapa.query().insert({
    codigo,
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0,
    etapa_final: etapaFinal
  });
}

async function atualizarFunilEtapa(id, dados) {
  const atualizacao = {};

  if (dados.codigo !== undefined) atualizacao.codigo = normalizarCodigoEtapa(dados.codigo);
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;
  if (dados.etapa_final !== undefined) atualizacao.etapa_final = Boolean(dados.etapa_final);

  await validarEtapaFinalUnica(atualizacao.etapa_final, id);

  return FunilEtapa.query().patchAndFetchById(id, atualizacao);
}

async function validarEtapaFinalUnica(etapaFinal, ignorarId = null) {
  if (!etapaFinal) return;

  const existente = await FunilEtapa.query()
    .where('etapa_final', true)
    .modify(query => {
      if (ignorarId) query.whereNot('id', Number(ignorarId));
    })
    .first();

  if (existente) {
    throw new Error('Ja existe uma etapa final definida para o funil.');
  }
}

async function excluirFunilEtapa(id) {
  const etapa = await FunilEtapa.query().findById(id);

  if (!etapa) {
    return null;
  }

  const vendasCount = await Venda.query()
    .where('status_funil', etapa.codigo)
    .resultSize();

  if (vendasCount > 0) {
    const etapaDesativada = await FunilEtapa.query().patchAndFetchById(id, { ativo: false });

    return {
      acao: 'desativada',
      vendasCount,
      etapa: etapaDesativada
    };
  }

  await FunilEtapa.query().deleteById(id);

  return {
    acao: 'excluida',
    vendasCount,
    etapa
  };
}

function parseValorMonetario(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = String(valor).trim().replace(/[^\d,.-]/g, '');

  if (!texto) return null;
  if (texto.includes(',')) {
    return Number(texto.replace(/\./g, '').replace(',', '.'));
  }

  return Number(texto);
}

function normalizarRegraComissao(dados) {
  const valorMin = parseValorMonetario(dados.valor_min);
  const valorMax = parseValorMonetario(dados.valor_max);
  const valorComissao = parseValorMonetario(dados.valor_comissao);
  const valorComissaoBase = parseValorMonetario(dados.valor_comissao_base ?? dados.valor_comissao);
  const valorComissaoBasePropria = parseValorMonetario(
    dados.valor_comissao_base_propria ?? dados.valor_comissao_base ?? dados.valor_comissao
  );
  const prioridadeBaseDupla = ['base_propria', 'base_operadora'].includes(dados.prioridade_base_dupla)
    ? dados.prioridade_base_dupla
    : 'base_propria';

  if (!Number.isFinite(valorMin) || valorMin < 0) {
    throw new Error('Informe um valor inicial valido.');
  }

  if (!Number.isFinite(valorMax) || valorMax < 0) {
    throw new Error('Informe um valor final valido.');
  }

  if (valorMax < valorMin) {
    throw new Error('O valor final deve ser maior ou igual ao valor inicial.');
  }

  if (!Number.isFinite(valorComissao) || valorComissao < 0) {
    throw new Error('Informe uma comissao valida.');
  }

  if (!Number.isFinite(valorComissaoBase) || valorComissaoBase < 0) {
    throw new Error('Informe uma comissao de base da operadora valida.');
  }

  if (!Number.isFinite(valorComissaoBasePropria) || valorComissaoBasePropria < 0) {
    throw new Error('Informe uma comissao da nossa base valida.');
  }

  const operadoraId = dados.operadora_id ? Number(dados.operadora_id) : null;
  if (operadoraId !== null && !Number.isFinite(operadoraId)) {
    throw new Error('Informe uma operadora valida.');
  }

  return {
    operadora_id: operadoraId,
    valor_min: Number(valorMin.toFixed(2)),
    valor_max: Number(valorMax.toFixed(2)),
    valor_comissao: Number(valorComissao.toFixed(2)),
    valor_comissao_base: Number(valorComissaoBase.toFixed(2)),
    valor_comissao_base_propria: Number(valorComissaoBasePropria.toFixed(2)),
    prioridade_base_dupla: prioridadeBaseDupla,
    ativo: dados.ativo ?? true
  };
}

async function validarSobreposicaoRegraComissao(regra, ignorarId = null) {
  if (!regra.ativo) return;

  const sobreposta = await RegraComissao.query()
    .where('ativo', true)
    .where('valor_min', '<=', regra.valor_max)
    .where('valor_max', '>=', regra.valor_min)
    .modify(query => {
      if (ignorarId) query.whereNot('id', Number(ignorarId));
      if (regra.operadora_id) {
        query.where('operadora_id', regra.operadora_id);
      } else {
        query.whereNull('operadora_id');
      }
    })
    .first();

  if (sobreposta) {
    throw new Error('Ja existe uma regra ativa que sobrepoe essa faixa de valor para essa operadora.');
  }
}

async function criarRegraComissao(dados) {
  const regra = normalizarRegraComissao(dados);
  await validarSobreposicaoRegraComissao(regra);

  const regraCriada = await RegraComissao.query().insert(regra);
  return ocultarOrdem(regraCriada);
}

async function atualizarRegraComissao(id, dados) {
  const atual = await RegraComissao.query().findById(id);

  if (!atual) return null;

  const regra = normalizarRegraComissao({
    operadora_id: dados.operadora_id !== undefined ? dados.operadora_id : atual.operadora_id,
    valor_min: dados.valor_min ?? atual.valor_min,
    valor_max: dados.valor_max ?? atual.valor_max,
    valor_comissao: dados.valor_comissao ?? atual.valor_comissao,
    valor_comissao_base: dados.valor_comissao_base ?? atual.valor_comissao_base ?? atual.valor_comissao,
    valor_comissao_base_propria: dados.valor_comissao_base_propria ?? atual.valor_comissao_base_propria ?? atual.valor_comissao_base ?? atual.valor_comissao,
    prioridade_base_dupla: dados.prioridade_base_dupla ?? atual.prioridade_base_dupla ?? 'base_propria',
    ativo: dados.ativo ?? atual.ativo
  });
  await validarSobreposicaoRegraComissao(regra, id);

  const regraAtualizada = await RegraComissao.query().patchAndFetchById(id, regra);
  return ocultarOrdem(regraAtualizada);
}

async function excluirRegraComissao(id) {
  return RegraComissao.query().deleteById(id);
}

async function criarLinkExterno(dados) {
  const link = await LinkExterno.query().insert({
    chave: dados.chave,
    nome: dados.nome,
    url: dados.url,
    dot: dados.dot || null,
    ativo: dados.ativo ?? true
  });

  return ocultarOrdem(link);
}

async function atualizarLinkExterno(id, dados) {
  const atualizacao = {};

  if (dados.chave !== undefined) atualizacao.chave = dados.chave;
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.url !== undefined) atualizacao.url = dados.url;
  if (dados.dot !== undefined) atualizacao.dot = dados.dot || null;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;

  const link = await LinkExterno.query().patchAndFetchById(id, atualizacao);
  return ocultarOrdem(link);
}

async function excluirLinkExterno(id) {
  return LinkExterno.query().deleteById(id);
}

module.exports = {
  listarOperadoras,
  listarOperadorasAtivas,
  criarOperadora,
  atualizarOperadora,
  excluirOperadora,
  listarTiposProduto,
  listarTiposProdutoAtivos,
  criarTipoProduto,
  atualizarTipoProduto,
  excluirTipoProduto,
  listarTiposVenda,
  listarTiposVendaAtivos,
  criarTipoVenda,
  atualizarTipoVenda,
  excluirTipoVenda,
  listarServicos,
  listarServicosAtivos,
  criarServico,
  atualizarServico,
  excluirServico,
  listarFunilEtapas,
  listarFunilEtapasAtivas,
  criarFunilEtapa,
  atualizarFunilEtapa,
  excluirFunilEtapa,
  listarRegrasComissao,
  listarRegrasComissaoAtivas,
  criarRegraComissao,
  atualizarRegraComissao,
  excluirRegraComissao,
  listarLinksExternos,
  listarLinksExternosAtivos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
