const Venda = require('../models/Venda');
const FunilEtapa = require('../models/FunilEtapa');
const RegraComissao = require('../models/RegraComissao');

const STATUS_FINAL_FALLBACK = 'concluido';

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

function dataVendaReferenciaSQL(alias = 'v') {
  return `COALESCE(NULLIF(NULLIF(${alias}.data_venda, '0000-00-00'), '1899-11-30'), DATE(${alias}.created_at))`;
}

function dataAtivacaoReferenciaSQL(alias = 'v') {
  return `COALESCE(NULLIF(NULLIF(${alias}.data_ativacao, '0000-00-00'), '1899-11-30'), ${dataVendaReferenciaSQL(alias)})`;
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
      tipo_linha: (item.tipo_linha || item.tipo || item.categoria)
        ? tipoVendaNormalizado(item.tipo_linha || item.tipo || item.categoria) || 'novo'
        : null,
      valor_unitario: Number(item.valor_unitario || 0)
    }))
    .filter(item => item.quantidade > 0);
}

function extrairNumerosGigas(valor) {
  const texto = String(valor || '');
  const matches = texto.match(/\d+(?:[.,]\d+)?/g) || [];

  return matches
    .map(item => Number(String(item).replace(',', '.')))
    .filter(numero => Number.isFinite(numero) && numero > 0);
}

function formatarGigas(numero) {
  const valor = Number(numero || 0);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const texto = Number.isInteger(valor)
    ? String(valor)
    : valor.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');

  return `${texto}GB`;
}

function gigasUnitarios(gbPrincipal, quantidade, gbFallback = '') {
  const totalChips = Math.max(Number(quantidade || 0), 0);
  if (totalChips === 0) return [];

  const textoPrincipal = String(gbPrincipal || '').trim();
  const textoFallback = String(gbFallback || '').trim();
  const texto = textoPrincipal || textoFallback;
  if (!texto) return Array(totalChips).fill('');

  const numeros = extrairNumerosGigas(texto);

  if (numeros.length === 1) {
    return Array(totalChips).fill(formatarGigas(numeros[0]) || texto);
  }

  if (numeros.length >= totalChips) {
    return numeros.slice(0, totalChips).map(formatarGigas);
  }

  if (numeros.length > 1) {
    const totalGigas = numeros.reduce((soma, numero) => soma + numero, 0);
    return Array(totalChips).fill(formatarGigas(totalGigas / totalChips));
  }

  return Array(totalChips).fill(texto);
}

async function carregarRegrasComissaoAtivas() {
  return RegraComissao.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('valor_min', 'asc')
    .orderBy('valor_max', 'asc');
}

async function obterCodigoEtapaFinal() {
  try {
    const etapa = await FunilEtapa.query()
      .where('etapa_final', true)
      .orderBy('ativo', 'desc')
      .orderBy('ordem', 'asc')
      .first();

    return etapa?.codigo || STATUS_FINAL_FALLBACK;
  } catch {
    return STATUS_FINAL_FALLBACK;
  }
}

function encontrarRegraComissao(regras, valorUnitario) {
  const valor = Number(valorUnitario || 0);
  if (!Number.isFinite(valor)) return null;

  return regras.find(regra => (
    valor >= Number(regra.valor_min || 0)
    && valor <= Number(regra.valor_max || 0)
  )) || null;
}

function montarRegraComissaoResumo(regra) {
  if (!regra) return null;

  return {
    id: regra.id,
    valor_min: Number(regra.valor_min || 0),
    valor_max: Number(regra.valor_max || 0),
    valor_comissao: Number(regra.valor_comissao || 0)
  };
}

function quantidadeChipsVenda(venda) {
  const chips = parseChips(venda.valores_unitarios_chips);
  const totalChips = chips.reduce((soma, item) => soma + item.quantidade, 0);
  if (totalChips > 0) return totalChips;

  const linhas = Number(venda.quantidade_linhas || 0);
  return linhas > 0 ? linhas : 0;
}

function quantidadeChipsPorTipo(venda, tipo) {
  const chips = parseChips(venda.valores_unitarios_chips);
  const temTipoPorItem = chips.length > 0 && chips.some(chip => chip.tipo_linha);

  if (temTipoPorItem) {
    return chips.reduce((soma, chip) => (
      chip.tipo_linha === tipo ? soma + chip.quantidade : soma
    ), 0);
  }

  return tipoVendaNormalizado(venda.tipo_venda_nome) === tipo ? quantidadeChipsVenda(venda) : 0;
}

async function carregarVendasNoPeriodo(filtros, criterioData = 'registro') {
  const inicio = normalizarData(filtros.data_inicio);
  const fim = normalizarData(filtros.data_fim);
  const statusFinal = await obterCodigoEtapaFinal();
  const dataReferencia = criterioData === 'ativacao'
    ? dataAtivacaoReferenciaSQL('v')
    : dataVendaReferenciaSQL('v');

  const query = Venda.query()
    .alias('v')
    .leftJoin('operadoras as o', 'v.operadora_id', 'o.id')
    .leftJoin('tipos_venda as tv', 'v.tipo_venda_id', 'tv.id')
    .leftJoin('servicos as s', 'v.servico_id', 's.id')
    .leftJoin('usuarios as u', 'v.vendedora_id', 'u.id')
    .leftJoin('clientes as c', 'v.cliente_id', 'c.id')
    
    .whereNull('v.excluido_em')
    .whereNot('v.status_funil', 'retorno')
    .select(
      'v.id',
      'v.status_funil',
      'v.valor_total',
      'v.valores_unitarios_chips',
      'v.quantidade_linhas',
      'v.data_venda',
      'v.data_ativacao',
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
      'o.nome as operadora_nome',
      'tv.nome as tipo_venda_nome',
      's.nome as servico_nome',
      'u.nome as vendedora_nome',
      'u.email as vendedora_email',
      'c.nome as cliente_nome',
      'c.razao_social as cliente_razao_social',
      'c.cnpj as cliente_cnpj',
      'c.fidelidade_fim as cliente_fidelidade_fim',

    );

  if (inicio) {
    query.whereRaw(`${dataReferencia} >= ?`, [inicio]);
  }

  if (fim) {
    query.whereRaw(`${dataReferencia} <= ?`, [fim]);
  }

  return {
    vendas: await query,
    statusFinal
  };
}

function classificarSecao(statusFunil, statusFinal = STATUS_FINAL_FALLBACK) {
  if (statusFunil === statusFinal) return 'ativas';
  if (statusFunil && statusFunil !== 'retorno') return 'tratando';
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

function agregarPorOperadora(vendas, statusFinal = STATUS_FINAL_FALLBACK) {
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
    const chipsNovos = quantidadeChipsPorTipo(venda, 'novo');
    const chipsPortabilidade = quantidadeChipsPorTipo(venda, 'portabilidade');
    const valor = Number(venda.valor_total || 0);
    const chips = quantidadeChipsVenda(venda);
    const ehContrato = venda.status_funil === statusFinal;

    const aplicar = (linha) => {
      linha.total_vendas += 1;
      if (ehContrato) {
        linha.contratos += 1;
        linha.ugrs += chips;
      }
      if (categoria === 'movel') linha.movel += 1;
      if (categoria === 'fixo') linha.fixo += 1;
      if (categoria === 'internet') linha.internet += 1;
      linha.novo += chipsNovos;
      linha.portabilidade += chipsPortabilidade;
      linha.receita += valor;
    };

    aplicar(inicializa(total));

    const secao = classificarSecao(venda.status_funil, statusFinal);
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
  const { vendas: vendasRegistro, statusFinal } = await carregarVendasNoPeriodo(filtros, 'registro');
  const { vendas: vendasAtivacao } = await carregarVendasNoPeriodo(filtros, 'ativacao');
  const resumoRegistro = agregarPorOperadora(vendasRegistro, statusFinal);
  const resumoAtivacao = agregarPorOperadora(vendasAtivacao, statusFinal);

  return {
    periodo: {
      data_inicio: normalizarData(filtros.data_inicio),
      data_fim: normalizarData(filtros.data_fim)
    },
    secoes: {
      total: resumoRegistro.total,
      tratando: resumoRegistro.tratando,
      ativas: resumoAtivacao.ativas
    }
  };
}

function filtrarPorSecao(vendas, secao, statusFinal = STATUS_FINAL_FALLBACK) {
  if (secao === 'tratando') {
    return vendas.filter(v => v.status_funil && v.status_funil !== statusFinal && v.status_funil !== 'retorno');
  }
  if (secao === 'ativas') {
    return vendas.filter(v => v.status_funil === statusFinal);
  }
  return vendas;
}

function montarVendaResumo(venda, statusFinal = STATUS_FINAL_FALLBACK) {
  const categoria = categoriaServico(venda.servico_nome);
  const chipsNovos = quantidadeChipsPorTipo(venda, 'novo');
  const chipsPortabilidade = quantidadeChipsPorTipo(venda, 'portabilidade');

  return {
    id: venda.id,
    data_venda: venda.data_venda || venda.created_at || null,
    data_ativacao: venda.data_ativacao || null,
    data_fechamento: venda.status_funil === statusFinal
      ? (venda.data_ativacao || venda.data_venda || venda.created_at || null)
      : (venda.data_venda || venda.created_at || null),
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
    tipo_servico_normalizado: chipsNovos > 0 && chipsPortabilidade > 0
      ? 'misto'
      : chipsPortabilidade > 0 ? 'portabilidade' : chipsNovos > 0 ? 'novo' : null,
    chips_novos: chipsNovos,
    chips_portabilidade: chipsPortabilidade,

  };
}

async function obterDetalhes(filtros = {}) {
  const criterioData = filtros.secao === 'ativas' ? 'ativacao' : 'registro';
  const { vendas: todasVendas, statusFinal } = await carregarVendasNoPeriodo(filtros, criterioData);
  const vendasSecao = filtrarPorSecao(todasVendas, filtros.secao, statusFinal);

  const filtradas = filtros.operadora_id
    ? vendasSecao.filter(v => Number(v.operadora_id) === Number(filtros.operadora_id))
    : vendasSecao;

  return filtradas
    .map(venda => montarVendaResumo(venda, statusFinal))
    .sort((a, b) => {
      const dataA = a.data_fechamento || '';
      const dataB = b.data_fechamento || '';
      return dataB.localeCompare(dataA);
    });
}

async function obterDetalhesChips(filtros = {}) {
  const { vendas: todasVendas, statusFinal } = await carregarVendasNoPeriodo(filtros, 'ativacao');
  const regrasComissao = await carregarRegrasComissaoAtivas();
  const vendasAtivas = filtrarPorSecao(todasVendas, 'ativas', statusFinal);
  const filtradas = filtros.operadora_id
    ? vendasAtivas.filter(v => Number(v.operadora_id) === Number(filtros.operadora_id))
    : vendasAtivas;

  const linhas = [];

  function montarLinhaComRegra(venda, chip) {
    const linha = montarLinhaChip(venda, chip);
    const regra = encontrarRegraComissao(regrasComissao, linha.valor_unitario);

    if (!regra) {
      return {
        ...linha,
        regra_comissao: null,
        comissao: null,
        sem_regra: true
      };
    }

    return {
      ...linha,
      regra_comissao: montarRegraComissaoResumo(regra),
      comissao: Number(Number(regra.valor_comissao || 0).toFixed(2)),
      sem_regra: false
    };
  }

  filtradas.forEach(venda => {
    const chips = parseChips(venda.valores_unitarios_chips);

    if (chips.length === 0) {
      const linhasFallback = Number(venda.quantidade_linhas || 0) || 1;
      const valorFallback = Number(venda.valor_total || 0) / linhasFallback;
      const gigasFallback = gigasUnitarios(venda.gb, linhasFallback);

      for (let i = 0; i < linhasFallback; i++) {
        linhas.push(montarLinhaComRegra(venda, {
          chip_index: i + 1,
          gb: gigasFallback[i] || '',
          tipo_linha: tipoVendaNormalizado(venda.tipo_venda_nome) || 'novo',
          valor_unitario: valorFallback
        }));
      }
      return;
    }

    let chipNumero = 1;
    chips.forEach(item => {
      const gigas = gigasUnitarios(item.gb, item.quantidade, venda.gb);

      for (let i = 0; i < item.quantidade; i++) {
        linhas.push(montarLinhaComRegra(venda, {
          chip_index: chipNumero,
          gb: gigas[i] || '',
          tipo_linha: item.tipo_linha,
          valor_unitario: item.valor_unitario
        }));
        chipNumero += 1;
      }
    });
  });

  const linhasOrdenadas = linhas.sort((a, b) => {
    const dataA = a.data_fechamento || '';
    const dataB = b.data_fechamento || '';
    const cmp = dataB.localeCompare(dataA);
    if (cmp !== 0) return cmp;
    return Number(a.venda_id) - Number(b.venda_id);
  });
  const totaisVendedora = new Map();

  linhasOrdenadas.forEach(linha => {
    if (linha.comissao === null || !linha.vendedora) return;
    const chave = linha.vendedora.id || 'sem_vendedora';
    const atual = totaisVendedora.get(chave) || {
      vendedora_id: linha.vendedora.id || null,
      vendedora_nome: linha.vendedora.nome || 'Sem vendedora',
      total_ugrs: 0,
      total_comissao: 0
    };

    atual.total_ugrs += 1;
    atual.total_comissao += linha.comissao;
    totaisVendedora.set(chave, atual);
  });

  return {
    linhas: linhasOrdenadas,
    totais_por_vendedora: Array.from(totaisVendedora.values())
      .map(item => ({ ...item, total_comissao: Number(item.total_comissao.toFixed(2)) }))
      .sort((a, b) => b.total_comissao - a.total_comissao),
    total_geral: {
      chips: linhas.length,
      valor: Number(linhas.reduce((soma, l) => soma + Number(l.valor_unitario || 0), 0).toFixed(2)),
      comissao: Number(linhas.reduce((soma, l) => soma + Number(l.comissao || 0), 0).toFixed(2)),
      ugrs_sem_regra: linhas.filter(linha => linha.sem_regra).length
    }
  };
}

function montarLinhaChip(venda, chip) {
  return {
    venda_id: venda.id,
    chip_index: chip.chip_index,
    data_venda: venda.data_venda || venda.created_at || null,
    data_ativacao: venda.data_ativacao || null,
    data_fechamento: venda.data_ativacao || venda.data_venda || venda.created_at || null,
    status_funil: venda.status_funil,
    ddd: venda.ddd || null,
    gb: chip.gb || null,
    tipo_linha: chip.tipo_linha || null,
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
    servico: venda.servico_nome || null
  };
}

module.exports = {
  obterResumo,
  obterDetalhes,
  obterDetalhesChips
};
