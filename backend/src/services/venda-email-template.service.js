function texto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function normalizarTexto(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function linha(label, value) {
  const valor = texto(value);
  return valor ? `${label} : ${valor}` : `${label} :`;
}

function telefone(numero) {
  let valor = texto(numero);
  if (valor.startsWith('+55')) valor = valor.slice(3);
  return valor.replace(/[()\-\s]/g, '');
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = parseNumero(valor);

  if (!Number.isFinite(numero)) return texto(valor);

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarDecimal(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarData(valor) {
  const raw = texto(valor);
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  return raw;
}

function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  const raw = String(valor).replace(/\s/g, '').replace(/^R\$/i, '');
  const temVirgula = raw.includes(',');
  const temPonto = raw.includes('.');
  let normalizado = raw;

  if (temVirgula && temPonto) {
    normalizado = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = raw.replace(',', '.');
  } else if (temPonto) {
    const partes = raw.split('.');
    const ultimaParte = partes[partes.length - 1];
    normalizado = partes.length === 2 && ultimaParte.length <= 2
      ? raw
      : raw.replace(/\./g, '');
  }

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : 0;
}

function parseItensChips(valor, gbPadrao = '') {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    return valor
      .map(item => ({
        quantidade: Number(item.quantidade || 0),
        gb: texto(item.gb || gbPadrao),
        valorUnitario: parseNumero(item.valor_unitario)
      }))
      .filter(item => item.quantidade > 0);
  }

  if (typeof valor === 'string') {
    try {
      return parseItensChips(JSON.parse(valor), gbPadrao);
    } catch {
      return valor
        .split(/\r?\n|\/+/)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
          const match = item.match(/^(\d+)\s*x\s*([\d.,]+)/i);
          if (!match) return null;
          return {
            quantidade: Number(match[1]),
            gb: texto(gbPadrao),
            valorUnitario: parseNumero(match[2])
          };
        })
        .filter(Boolean);
    }
  }

  return [];
}

function parsePortados(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    return valor.map(texto).filter(Boolean);
  }

  if (typeof valor === 'string') {
    try {
      return parsePortados(JSON.parse(valor));
    } catch {
      return valor
        .split(/\r?\n|[,;]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function quantidadeLinhas(venda, itens) {
  const qtdVenda = Number(venda.quantidade_linhas || 0);
  if (qtdVenda > 0) return qtdVenda;

  const qtdItens = itens.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  return qtdItens > 0 ? qtdItens : 0;
}

function precoUnitarioPadrao(venda, qtd) {
  if (!qtd) return '';
  const total = parseNumero(venda.valor_total);
  if (!total) return '';

  return formatarDecimal(total / qtd);
}

function valorTotal(venda) {
  return formatarMoeda(venda.valor_total);
}

function gbComSufixo(valor) {
  const gb = texto(valor);
  if (!gb) return '';
  return /gb$/i.test(gb) ? gb : `${gb}GB`;
}

function nomeCliente(venda) {
  return texto(venda.razao_social || venda.cliente?.razao_social || venda.cliente?.nome || venda.nome);
}

function nomeVendedora(venda) {
  return texto(venda.vendedora?.nome);
}

function montarContexto(venda) {
  const itens = parseItensChips(venda.valores_unitarios_chips, venda.gb);
  const portados = parsePortados(venda.numeros_portados);
  const qtd = quantidadeLinhas(venda, itens);

  return {
    itens,
    portados,
    qtd,
    qtdPortados: portados.length,
    qtdNovas: Math.max(0, qtd - portados.length),
    precoUnitario: precoUnitarioPadrao(venda, qtd),
    cliente: nomeCliente(venda),
    vendedora: nomeVendedora(venda)
  };
}

function formatarPlanoClaro(venda, ctx) {
  if (ctx.itens.length > 0) {
    return ctx.itens
      .map(item => {
        const gbTexto = item.gb || venda.gb
          ? gbComSufixo(item.gb || venda.gb)
          : texto(venda.produto_fechado);
        const preco = item.valorUnitario ? formatarDecimal(item.valorUnitario) : ctx.precoUnitario;
        return preco
          ? `CLARO PÓS ${gbTexto} (${item.quantidade}X${preco})`
          : `CLARO PÓS ${gbTexto}`;
      })
      .join(' + ');
  }

  const gbTexto = venda.gb ? gbComSufixo(venda.gb) : texto(venda.produto_fechado);
  return ctx.precoUnitario
    ? `CLARO PÓS ${gbTexto} (${ctx.qtd}X${ctx.precoUnitario})`
    : `CLARO PÓS ${gbTexto}`.trim();
}

function renderClaro(venda) {
  const ctx = montarContexto(venda);
  const plano = `${formatarPlanoClaro(venda, ctx)}${venda.ddd ? `  - DDD ${venda.ddd}` : ''}`;

  return [
    `VENDA ${ctx.vendedora} - ${ctx.cliente}`,
    '',
    'CLARO',
    '',
    `DATA DA VENDA: ${formatarData(venda.data_venda)}`,
    `Consultor: ${ctx.vendedora}`,
    `CLIENTE: ${ctx.cliente}`,
    `CNPJ: ${texto(venda.cnpj || venda.cliente?.cnpj)}`,
    'ENDEREÇO:',
    `Logradouro: ${texto(venda.endereco)}    Número: ${texto(venda.numero_endereco)}    Complemento: ${texto(venda.complemento)}`,
    `CEP: ${texto(venda.cep)}   Bairro: ${texto(venda.bairro)}   Município: ${texto(venda.municipio)}   UF: ${texto(venda.uf)}`,
    `PONTO DE REFERÊNCIA: ${texto(venda.ponto_referencia)}`,
    `RESPONSÁVEL: ${texto(venda.nome_representante_legal)}`,
    `CPF: ${texto(venda.cpf_representante_legal)}`,
    `Melhor horário para fazer aceite de voz: ${texto(venda.horario_aceite_voz)}`,
    `Telefone: ${telefone(venda.telefone)}`,
    `Telefone: ${telefone(venda.fixo_ddd)}`,
    `EMAIL: ${texto(venda.email)}`,
    `PLANO: ${plano}`,
    `TOTAL: ${valorTotal(venda)}`,
    '',
    'Docs ok',
    '',
    `OBS CONSULTOR: ${texto(venda.observacoes)}`,
    'LOGIN:   SENHA:'
  ].join('\n');
}

function planoVivo(venda, ctx) {
  if (ctx.itens.length > 0) {
    const gbParts = ctx.itens.map(item => {
      const gb = gbComSufixo(item.gb || venda.gb);
      return `VIVO ${gb}`.trim();
    });
    const priceParts = ctx.itens.map(item => {
      const preco = item.valorUnitario ? formatarDecimal(item.valorUnitario) : ctx.precoUnitario;
      return preco ? `${item.quantidade}X${preco}` : '';
    }).filter(Boolean);

    return `${gbParts.join(' + ')}${priceParts.length ? ` - ${priceParts.join(' + ')}` : ''}${venda.ddd ? ` - DDD ${venda.ddd}` : ''}`;
  }

  const partes = [`VIVO ${gbComSufixo(venda.gb)}`.trim()];
  if (ctx.qtd && ctx.precoUnitario) partes.push(`${ctx.qtd}X${ctx.precoUnitario}`);
  if (venda.ddd) partes.push(`DDD ${venda.ddd}`);

  return partes.length > 1 ? partes.join(' - ') : '';
}

function renderVivo(venda) {
  const ctx = montarContexto(venda);
  const linhaNova = ctx.qtdNovas && ctx.precoUnitario ? `${ctx.qtdNovas}x${ctx.precoUnitario}` : 'X';
  const portabilidade = ctx.qtdPortados && ctx.precoUnitario ? `${ctx.qtdPortados}x${ctx.precoUnitario}` : 'X';

  return [
    `VENDA ${ctx.vendedora} - ${ctx.cliente}`,
    '',
    'Segue Checklist Pedidos Móvel Vivo',
    '',
    'PEDIDO 1 ACEITE MÓVEL',
    '',
    linha('RAZAO SOCIAL', ctx.cliente),
    linha('CNPJ', venda.cnpj || venda.cliente?.cnpj),
    linha('REPRESENTANTE LEGAL', venda.nome_representante_legal),
    linha('CPF REPRESENTANTE LEGAL', venda.cpf_representante_legal),
    linha('EMAIL PARA ENVIO ACEITE', venda.email),
    linha('TELEFONE', telefone(venda.fixo_ddd || venda.telefone)),
    linha('CONFIRMAÇÃO FALAR COM', venda.nome_fechou_venda),
    linha('ENDEREÇO', venda.endereco || venda.ponto_referencia || venda.tipo_local_cpf),
    linha('LINHA NOVA', linhaNova),
    linha('PORTABILIDADE', portabilidade),
    linha('LINHA COM DDD X PLANO', planoVivo(venda, ctx)),
    linha('VALOR TOTAL NEGOCIADO', valorTotal(venda)),
    '',
    linha('VENCIMENTO', venda.dia_vencimento),
    linha('OBSERVAÇÃO', venda.observacoes)
  ].join('\n');
}

function resolverOperadora(venda) {
  const nome = texto(venda.operadora?.nome);
  const normalizado = normalizarTexto(nome);

  if (normalizado.includes('claro')) return 'Claro';
  if (normalizado.includes('vivo')) return 'Vivo';

  return null;
}

function renderEmailVenda(venda) {
  const operadora = resolverOperadora(venda);

  if (!operadora) {
    const error = new Error('Operadora sem template de email. Use Claro ou Vivo.');
    error.statusCode = 400;
    throw error;
  }

  return {
    operadora,
    texto: operadora === 'Claro' ? renderClaro(venda) : renderVivo(venda)
  };
}

module.exports = {
  renderEmailVenda,
  _internals: {
    parseItensChips,
    parsePortados,
    resolverOperadora
  }
};
