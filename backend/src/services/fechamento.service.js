const Venda = require('../models/Venda');

const STATUS_TRATANDO = ['aprovacao', 'ativacao', 'envio', 'entrega', 'confirmacao'];
const STATUS_ATIVAS = ['concluido'];

const CATEGORIA_POR_SERVICO = {
  'telefonia movel': 'movel',
  'movel': 'movel',
  'telefonia fixa': 'fixo',
  'fixo': 'fixo',
  'internet': 'internet'
};

function normalizarServicoNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function categoriaServico(servicoNome) {
  if (!servicoNome) return null;
  return CATEGORIA_POR_SERVICO[normalizarServicoNome(servicoNome)] || null;
}

function tipoVendaNormalizado(tipoVendaNome) {
  if (!tipoVendaNome) return null;
  const nome = normalizarServicoNome(tipoVendaNome);
  if (nome.includes('porta')) return 'portabilidade';
  if (nome.includes('novo')) return 'novo';
  return null;
}

function normalizarData(valor) {
  if (!valor) return null;
  const texto = String(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

function parseChips(rawChips) {
  if (!rawChips) return [];

  let lista = rawChips;
  if (typeof rawChips === 'string') {
    try {
      lista = JSON.parse(rawChips);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(lista)) return [];

  return lista
    .map(item => ({
      quantidade: Number(item.quantidade || 0),
      gb: String(item.gb || '').trim(),
      valor_unitario: Number(item.valor_unitario || 0)
    }))
    .filter(item => item.quantidade > 0);
}

function quantidadeChipsVenda(venda) {
  const chips = parseChips(venda.valores_unitarios_chips);
  const totalChips = chips.reduce((soma, item) => soma + item.quantidade, 0);
  if (totalChips > 0) return totalChips;

  const linhas = Number(venda.quantidade_linhas || 0);
  return linhas > 0 ? linhas : 0;
}

function carregarVendasNoPeriodo(filtros) {
  const inicio = normalizarData(filtros.data_inicio);
  const fim = normalizarData(filtros.data_fim);

  const query = Venda.query()
    .alias('v')
    .leftJoin('operadoras as o', 'v.operadora_id', 'o.id')
    .leftJoin('tipos_venda as tv', 'v.tipo_venda_id', 'tv.id')
    .leftJoin('servicos as s', 'v.servico_id', 's.id')
    .leftJoin('usuarios as u', 'v.vendedora_id', 'u.id')
    .leftJoin('clientes as c', 'v.cliente_id', 'c.id')
    .leftJoin('planos as p', 'v.plano_id', 'p.id')
    .whereNull('v.excluido_em')
    .whereNot('v.status_funil', 'retorno')
    .select(
      'v.id',
      'v.status_funil',
      'v.valor_total',
      'v.valores_unitarios_chips',
      'v.quantidade_linhas',
      'v.data_venda',
      'v.criado_em',
      'v.created_at',
      'v.dia_vencimento',
      'v.ddd',
      'v.gb',
      'v.operadora_id',
      'v.vendedora_id',
      'v.tipo_venda_id',
      'v.servico_id',
      'v.cliente_id',
      'v.plano_id',
      'o.nome as operadora_nome',
      'tv.nome as tipo_venda_nome',
      's.nome as servico_nome',
      'u.nome as vendedora_nome',
      'u.email as vendedora_email',
      'c.nome as cliente_nome',
      'c.razao_social as cliente_razao_social',
      'c.cnpj as cliente_cnpj',
      'c.fidelidade_fim as cliente_fidelidade_fim',
      'p.nome as plano_nome',
      'p.taxa_comissao as plano_taxa_comissao',
      'p.categoria as plano_categoria',
      'p.tipo_servico as plano_tipo_servico'
    );

  if (inicio) {
    query.whereRaw(
      "COALESCE(NULLIF(NULLIF(v.data_venda, '0000-00-00'), '1899-11-30'), DATE(v.created_at)) >= ?",
      [inicio]
    );
  }

  if (fim) {
    query.whereRaw(
      "COALESCE(NULLIF(NULLIF(v.data_venda, '0000-00-00'), '1899-11-30'), DATE(v.created_at)) <= ?",
      [fim]
    );
  }

  return query;
}

function classificarSecao(statusFunil) {
  if (statusFunil === 'concluido') return 'ativas';
  if (STATUS_TRATANDO.includes(statusFunil)) return 'tratando';
  return null;
}

function novaLinhaOperadora(operadoraId, operadoraNome) {
  return {
    operadora_id: operadoraId,
    operadora_nome: operadoraNome || 'Sem operadora',
    total_vendas: 0,
    contratos: 0,
    ugrs: 0,
    movel: 0,
    fixo: 0,
    internet: 0,
    novo: 0,
    portabilidade: 0,
    receita: 0
  };
}

function agregarPorOperadora(vendas) {
  const total = new Map();
  const tratando = new Map();
  const ativas = new Map();

  vendas.forEach(venda => {
    const chave = venda.operadora_id ?? 'sem_operadora';
    const inicializa = (mapa) => {
      if (!mapa.has(chave)) {
        mapa.set(chave, novaLinhaOperadora(venda.operadora_id || null, venda.operadora_nome));
      }
      return mapa.get(chave);
    };

    const categoria = categoriaServico(venda.servico_nome);
    const tipoServico = tipoVendaNormalizado(venda.tipo_venda_nome);
    const valor = Number(venda.valor_total || 0);
    const chips = quantidadeChipsVenda(venda);
    const ehContrato = venda.status_funil === 'concluido';

    const aplicar = (linha) => {
      linha.total_vendas += 1;
      if (ehContrato) {
        linha.contratos += 1;
        linha.ugrs += chips;
      }
      if (categoria === 'movel') linha.movel += 1;
      if (categoria === 'fixo') linha.fixo += 1;
      if (categoria === 'internet') linha.internet += 1;
      if (tipoServico === 'novo') linha.novo += 1;
      if (tipoServico === 'portabilidade') linha.portabilidade += 1;
      linha.receita += valor;
    };

    aplicar(inicializa(total));

    const secao = classificarSecao(venda.status_funil);
    if (secao === 'tratando') {
      aplicar(inicializa(tratando));
    } else if (secao === 'ativas') {
      aplicar(inicializa(ativas));
    }
  });

  const finalizar = (mapa) => Array.from(mapa.values())
    .map(linha => ({
      ...linha,
      receita: Number(linha.receita.toFixed(2))
    }))
    .sort((a, b) => b.receita - a.receita);

  return {
    total: finalizar(total),
    tratando: finalizar(tratando),
    ativas: finalizar(ativas)
  };
}

async function obterResumo(filtros = {}) {
  const vendas = await carregarVendasNoPeriodo(filtros);

  return {
    periodo: {
      data_inicio: normalizarData(filtros.data_inicio),
      data_fim: normalizarData(filtros.data_fim)
    },
    secoes: agregarPorOperadora(vendas)
  };
}

function filtrarPorSecao(vendas, secao) {
  if (secao === 'tratando') {
    return vendas.filter(v => STATUS_TRATANDO.includes(v.status_funil));
  }
  if (secao === 'ativas') {
    return vendas.filter(v => STATUS_ATIVAS.includes(v.status_funil));
  }
  return vendas;
}

function montarVendaResumo(venda) {
  const categoria = categoriaServico(venda.servico_nome);
  const tipoServico = tipoVendaNormalizado(venda.tipo_venda_nome);

  return {
    id: venda.id,
    data_venda: venda.data_venda || venda.created_at || null,
    status_funil: venda.status_funil,
    valor_total: Number(venda.valor_total || 0),
    quantidade_linhas: Number(venda.quantidade_linhas || 0),
    chips_total: quantidadeChipsVenda(venda),
    dia_vencimento: venda.dia_vencimento || null,
    ddd: venda.ddd || null,
    gb: venda.gb || null,
    operadora: venda.operadora_id ? { id: venda.operadora_id, nome: venda.operadora_nome } : null,
    vendedora: venda.vendedora_id ? {
      id: venda.vendedora_id,
      nome: venda.vendedora_nome,
      email: venda.vendedora_email
    } : null,
    cliente: venda.cliente_id ? {
      id: venda.cliente_id,
      nome: venda.cliente_nome,
      razao_social: venda.cliente_razao_social,
      cnpj: venda.cliente_cnpj,
      fidelidade_fim: venda.cliente_fidelidade_fim
    } : null,
    tipo_venda: venda.tipo_venda_nome || null,
    servico: venda.servico_nome || null,
    categoria,
    tipo_servico_normalizado: tipoServico,
    plano: venda.plano_id ? {
      id: venda.plano_id,
      nome: venda.plano_nome,
      taxa_comissao: Number(venda.plano_taxa_comissao || 0),
      categoria: venda.plano_categoria,
      tipo_servico: venda.plano_tipo_servico
    } : null
  };
}

async function obterDetalhes(filtros = {}) {
  const todasVendas = await carregarVendasNoPeriodo(filtros);
  const vendasSecao = filtrarPorSecao(todasVendas, filtros.secao);

  const filtradas = filtros.operadora_id
    ? vendasSecao.filter(v => Number(v.operadora_id) === Number(filtros.operadora_id))
    : vendasSecao;

  return filtradas
    .map(montarVendaResumo)
    .sort((a, b) => {
      const dataA = a.data_venda || '';
      const dataB = b.data_venda || '';
      return dataB.localeCompare(dataA);
    });
}

async function obterDetalhesChips(filtros = {}) {
  const todasVendas = await carregarVendasNoPeriodo(filtros);
  const vendasAtivas = filtrarPorSecao(todasVendas, 'ativas');
  const filtradas = filtros.operadora_id
    ? vendasAtivas.filter(v => Number(v.operadora_id) === Number(filtros.operadora_id))
    : vendasAtivas;

  const linhas = [];

  filtradas.forEach(venda => {
    const chips = parseChips(venda.valores_unitarios_chips);
    const taxa = Number(venda.plano_taxa_comissao || 0);
    const temPlano = !!venda.plano_id;

    if (chips.length === 0) {
      const linhasFallback = Number(venda.quantidade_linhas || 0) || 1;
      const valorFallback = Number(venda.valor_total || 0) / linhasFallback;
      for (let i = 0; i < linhasFallback; i++) {
        linhas.push(montarLinhaChip(venda, {
          chip_index: i + 1,
          gb: venda.gb || '',
          valor_unitario: valorFallback,
          tem_plano: temPlano,
          taxa,
          comissao: temPlano ? Number((valorFallback * taxa / 100).toFixed(2)) : null
        }));
      }
      return;
    }

    let chipNumero = 1;
    chips.forEach(item => {
      for (let i = 0; i < item.quantidade; i++) {
        linhas.push(montarLinhaChip(venda, {
          chip_index: chipNumero,
          gb: item.gb,
          valor_unitario: item.valor_unitario,
          tem_plano: temPlano,
          taxa,
          comissao: temPlano ? Number((item.valor_unitario * taxa / 100).toFixed(2)) : null
        }));
        chipNumero += 1;
      }
    });
  });

  const totaisVendedora = new Map();
  linhas.forEach(linha => {
    if (linha.comissao === null || !linha.vendedora) return;
    const chave = linha.vendedora.id || 'sem_vendedora';
    const atual = totaisVendedora.get(chave) || {
      vendedora_id: linha.vendedora.id || null,
      vendedora_nome: linha.vendedora.nome || 'Sem vendedora',
      total_chips: 0,
      total_comissao: 0
    };
    atual.total_chips += 1;
    atual.total_comissao += linha.comissao;
    totaisVendedora.set(chave, atual);
  });

  return {
    linhas: linhas.sort((a, b) => {
      const dataA = a.data_venda || '';
      const dataB = b.data_venda || '';
      const cmp = dataB.localeCompare(dataA);
      if (cmp !== 0) return cmp;
      return Number(a.venda_id) - Number(b.venda_id);
    }),
    totais_por_vendedora: Array.from(totaisVendedora.values())
      .map(item => ({ ...item, total_comissao: Number(item.total_comissao.toFixed(2)) }))
      .sort((a, b) => b.total_comissao - a.total_comissao),
    total_geral: {
      chips: linhas.length,
      comissao: Number(linhas.reduce((soma, l) => soma + (l.comissao || 0), 0).toFixed(2))
    }
  };
}

function montarLinhaChip(venda, chip) {
  return {
    venda_id: venda.id,
    chip_index: chip.chip_index,
    data_venda: venda.data_venda || venda.created_at || null,
    status_funil: venda.status_funil,
    ddd: venda.ddd || null,
    gb: chip.gb || null,
    valor_unitario: Number(Number(chip.valor_unitario || 0).toFixed(2)),
    operadora: venda.operadora_id ? { id: venda.operadora_id, nome: venda.operadora_nome } : null,
    vendedora: venda.vendedora_id ? {
      id: venda.vendedora_id,
      nome: venda.vendedora_nome,
      email: venda.vendedora_email
    } : null,
    cliente: venda.cliente_id ? {
      id: venda.cliente_id,
      nome: venda.cliente_nome,
      razao_social: venda.cliente_razao_social,
      cnpj: venda.cliente_cnpj,
      fidelidade_fim: venda.cliente_fidelidade_fim
    } : null,
    tipo_venda: venda.tipo_venda_nome || null,
    servico: venda.servico_nome || null,
    plano: venda.plano_id ? {
      id: venda.plano_id,
      nome: venda.plano_nome,
      taxa_comissao: Number(venda.plano_taxa_comissao || 0)
    } : null,
    tem_plano: chip.tem_plano,
    taxa_comissao: chip.tem_plano ? chip.taxa : null,
    comissao: chip.comissao
  };
}

module.exports = {
  obterResumo,
  obterDetalhes,
  obterDetalhesChips
};
