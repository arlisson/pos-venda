const LinkExterno = require('../models/LinkExterno');
const Operadora = require('../models/Operadora');
const TipoProduto = require('../models/TipoProduto');
const TipoVenda = require('../models/TipoVenda');
const Servico = require('../models/Servico');
const FunilEtapa = require('../models/FunilEtapa');
const RegraComissao = require('../models/RegraComissao');
const Venda = require('../models/Venda');

function orderConfig(query) {
  return query.orderBy('ordem', 'asc').orderBy('nome', 'asc');
}

async function listarOperadoras() {
  return Operadora.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarLinksExternos() {
  return LinkExterno.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarTiposProduto() {
  return orderConfig(TipoProduto.query());
}

async function listarTiposVenda() {
  return orderConfig(TipoVenda.query());
}

async function listarServicos() {
  return orderConfig(Servico.query());
}

async function listarFunilEtapas() {
  return FunilEtapa.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarRegrasComissao() {
  return RegraComissao.query()
    .orderBy('ordem', 'asc')
    .orderBy('valor_min', 'asc')
    .orderBy('valor_max', 'asc');
}

async function listarOperadorasAtivas() {
  return Operadora.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarTiposProdutoAtivos() {
  return orderConfig(TipoProduto.query().where('ativo', true));
}

async function listarTiposVendaAtivos() {
  return orderConfig(TipoVenda.query().where('ativo', true));
}

async function listarServicosAtivos() {
  return orderConfig(Servico.query().where('ativo', true));
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
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarRegrasComissaoAtivas() {
  return RegraComissao.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('valor_min', 'asc')
    .orderBy('valor_max', 'asc');
}

async function criarOperadora(dados) {
  return Operadora.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarOperadora(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return Operadora.query().patchAndFetchById(id, atualizacao);
}

async function excluirOperadora(id) {
  return Operadora.query().deleteById(id);
}

async function criarTipoProduto(dados) {
  return TipoProduto.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarTipoProduto(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return TipoProduto.query().patchAndFetchById(id, atualizacao);
}

async function excluirTipoProduto(id) {
  return TipoProduto.query().deleteById(id);
}

async function criarTipoVenda(dados) {
  return TipoVenda.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarTipoVenda(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return TipoVenda.query().patchAndFetchById(id, atualizacao);
}

async function excluirTipoVenda(id) {
  return TipoVenda.query().deleteById(id);
}

async function criarServico(dados) {
  return Servico.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarServico(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return Servico.query().patchAndFetchById(id, atualizacao);
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
  const texto = String(valor).trim();

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

  return {
    valor_min: Number(valorMin.toFixed(2)),
    valor_max: Number(valorMax.toFixed(2)),
    valor_comissao: Number(valorComissao.toFixed(2)),
    ativo: dados.ativo ?? true,
    ordem: Number(dados.ordem || 0)
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
    })
    .first();

  if (sobreposta) {
    throw new Error('Ja existe uma regra ativa que sobrepoe essa faixa de valor.');
  }
}

async function criarRegraComissao(dados) {
  const regra = normalizarRegraComissao(dados);
  await validarSobreposicaoRegraComissao(regra);

  return RegraComissao.query().insert(regra);
}

async function atualizarRegraComissao(id, dados) {
  const atual = await RegraComissao.query().findById(id);

  if (!atual) return null;

  const regra = normalizarRegraComissao({
    valor_min: dados.valor_min ?? atual.valor_min,
    valor_max: dados.valor_max ?? atual.valor_max,
    valor_comissao: dados.valor_comissao ?? atual.valor_comissao,
    ativo: dados.ativo ?? atual.ativo,
    ordem: dados.ordem ?? atual.ordem
  });
  await validarSobreposicaoRegraComissao(regra, id);

  return RegraComissao.query().patchAndFetchById(id, regra);
}

async function excluirRegraComissao(id) {
  return RegraComissao.query().deleteById(id);
}

async function criarLinkExterno(dados) {
  return LinkExterno.query().insert({
    chave: dados.chave,
    nome: dados.nome,
    url: dados.url,
    dot: dados.dot || null,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarLinkExterno(id, dados) {
  const atualizacao = {};

  if (dados.chave !== undefined) atualizacao.chave = dados.chave;
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.url !== undefined) atualizacao.url = dados.url;
  if (dados.dot !== undefined) atualizacao.dot = dados.dot || null;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return LinkExterno.query().patchAndFetchById(id, atualizacao);
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
