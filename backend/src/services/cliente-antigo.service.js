const db = require('../database/connection');
const VendaAntiga = require('../models/VendaAntiga');
const VendaAntigaBusca = require('../models/VendaAntigaBusca');
const Usuario = require('../models/Usuario');
const {
  criarHttpError,
  lerArquivoMultipart,
  lerWorkbook,
  primeiraAbaComCabecalho,
  detectarCabecalhos,
  montarAmostras,
  normalizarTexto,
  sugerirColuna,
  textoCelula
} = require('../utils/planilha-xlsx');

const LIMITE_LINHAS = Number(process.env.VENDAS_ANTIGAS_LIMITE_LINHAS || 100000);
const CHUNK = 500;
const PALAVRAS_CABECALHO_CNPJ = ['cnpj', 'cpf/cnpj', 'documento'];

/**
 * Remove tudo que nao for digito, recupera zeros a esquerda comuns em CNPJ
 * numerico do Excel e limita a 14 caracteres.
 */
function sanitizarCnpj(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length >= 12 && digitos.length < 14) return digitos.padStart(14, '0');
  return digitos.slice(0, 14);
}

function cnpjRepetido(cnpj) {
  return /^(\d)\1{13}$/.test(cnpj);
}

function formatarCnpj(valor) {
  const d = sanitizarCnpj(valor);
  if (d.length !== 14) return String(valor || '').trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Tenta converter um texto de celula em data (YYYY-MM-DD). Retorna null se nao reconhecer.
 */
function parseDataVenda(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (br) {
    const dia = br[1].padStart(2, '0');
    const mes = br[2].padStart(2, '0');
    let ano = br[3];
    if (ano.length === 2) ano = Number(ano) > 50 ? `19${ano}` : `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

function normalizarNomeAba(valor) {
  return String(valor || '').trim().toLowerCase();
}

function parseAbasSelecionadas(valor) {
  if (!valor) return null;

  try {
    const abas = JSON.parse(valor);
    if (!Array.isArray(abas)) {
      throw new Error('Formato invalido');
    }

    return abas
      .map(aba => String(aba || '').trim())
      .filter(Boolean);
  } catch {
    throw criarHttpError(400, 'Selecao de abas invalida.');
  }
}

function filtrarWorksheets(workbook, nomesSelecionados = null) {
  if (!nomesSelecionados) return workbook.worksheets;

  const selecionadas = new Set(nomesSelecionados.map(normalizarNomeAba).filter(Boolean));
  const worksheets = workbook.worksheets.filter(worksheet => selecionadas.has(normalizarNomeAba(worksheet.name)));

  if (selecionadas.size === 0 || worksheets.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma aba valida para importar.');
  }

  return worksheets;
}

function detectarCabecalhoCnpj(worksheet) {
  return detectarCabecalhos(worksheet, { palavrasChave: PALAVRAS_CABECALHO_CNPJ });
}

function prepararAba(worksheet) {
  const cabecalho = detectarCabecalhoCnpj(worksheet);
  return {
    worksheet,
    colunas: cabecalho.colunas,
    linhaCabecalho: cabecalho.linhaCabecalho,
    linhas: Math.max(worksheet.rowCount - cabecalho.linhaCabecalho, 0)
  };
}

function tokensBusca(valor) {
  return normalizarTexto(valor)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function colunaCorrespondeBusca(coluna, busca) {
  const termo = normalizarTexto(busca);
  if (!termo) return false;

  const nome = normalizarTexto(coluna?.nome);
  if (!nome) return false;
  if (nome === termo || nome.includes(termo)) return true;

  const tokens = tokensBusca(busca);
  return tokens.length > 0 && tokens.every(token => nome.includes(token));
}

function resolverColuna(colunas, busca) {
  if (!busca) return null;
  return colunas.find(coluna => colunaCorrespondeBusca(coluna, busca)) || null;
}

/**
 * Preview da planilha: cabecalhos, amostras e colunas sugeridas para o mapeamento.
 * Considera TODAS as abas (cada aba costuma representar um mes com as mesmas colunas):
 * usa a primeira aba com cabecalho como referencia e soma as linhas de todas as abas.
 */
async function previewPlanilha(req) {
  const { arquivo } = await lerArquivoMultipart(req);
  const workbook = await lerWorkbook(arquivo.buffer);
  const { worksheet, colunas, linhaCabecalho } = primeiraAbaComCabecalho(workbook, { palavrasChave: PALAVRAS_CABECALHO_CNPJ });

  const abas = workbook.worksheets.map(aba => {
    try {
      const preparada = prepararAba(aba);
      return {
        nome: aba.name,
        linhas: preparada.linhas,
        linha_cabecalho: preparada.linhaCabecalho,
        colunas: preparada.colunas
      };
    } catch {
      return {
        nome: aba.name,
        linhas: 0,
        linha_cabecalho: null,
        colunas: []
      };
    }
  });
  const totalLinhas = abas.reduce((soma, aba) => soma + aba.linhas, 0);

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    linha_cabecalho: linhaCabecalho,
    abas,
    total_abas: abas.length,
    total_linhas: totalLinhas,
    limite_linhas: LIMITE_LINHAS,
    colunas,
    sugestoes: {
      cnpj: sugerirColuna(colunas, ['cnpj', 'cpf/cnpj', 'documento']),
      razao_social: sugerirColuna(colunas, ['razao', 'razao social', 'empresa']),
      nome_fantasia: sugerirColuna(colunas, ['fantasia', 'nome fantasia']),
      data_venda: sugerirColuna(colunas, ['data da venda', 'data venda', 'data'])
    },
    amostras: montarAmostras(worksheet, colunas, 5, linhaCabecalho)
  };
}

/**
 * Importa a planilha para a base de vendas antigas fazendo upsert por CNPJ.
 * campos.mapeamento = { cnpj, razao_social, nome_fantasia, data_venda } -> nomes de coluna.
 */
async function importarPlanilha(req, usuarioId) {
  const { arquivo, campos } = await lerArquivoMultipart(req);

  let mapeamento = {};
  try {
    mapeamento = campos.mapeamento ? JSON.parse(campos.mapeamento) : {};
  } catch {
    throw criarHttpError(400, 'Mapeamento de colunas invalido.');
  }

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna que contem o CNPJ.');
  }

  const workbook = await lerWorkbook(arquivo.buffer);
  const worksheets = filtrarWorksheets(workbook, parseAbasSelecionadas(campos.abas));
  const abasPreparadas = worksheets
    .map(worksheet => {
      try {
        return prepararAba(worksheet);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (abasPreparadas.length === 0) {
    throw criarHttpError(400, 'Nenhuma aba selecionada possui cabecalho de CNPJ valido.');
  }

  // As abas selecionadas compartilham as mesmas colunas (cada aba = um mes).
  const totalLinhas = abasPreparadas.reduce((soma, aba) => soma + aba.linhas, 0);
  if (totalLinhas > LIMITE_LINHAS) {
    throw criarHttpError(400, `A planilha excede o limite de ${LIMITE_LINHAS} linhas.`);
  }

  const lote = `${(arquivo.filename || 'planilha').replace(/\.xlsx$/i, '')}-${new Date().toISOString().slice(0, 19)}`;

  const registrosPorCnpj = new Map();
  let invalidos = 0;
  let duplicados = 0;

  for (const { worksheet, colunas, linhaCabecalho } of abasPreparadas) {
    const colunasResolvidas = {
      cnpj: resolverColuna(colunas, mapeamento.cnpj),
      razao_social: resolverColuna(colunas, mapeamento.razao_social),
      nome_fantasia: resolverColuna(colunas, mapeamento.nome_fantasia),
      data_venda: resolverColuna(colunas, mapeamento.data_venda)
    };

    if (!colunasResolvidas.cnpj) {
      throw criarHttpError(400, `Nao foi encontrada coluna de CNPJ na aba "${worksheet.name}" usando o texto "${mapeamento.cnpj}".`);
    }

    const mapeados = new Set(Object.values(colunasResolvidas).filter(Boolean).map(coluna => coluna.nome));
    const valorColuna = (row, coluna) => {
      if (!coluna) return '';
      return textoCelula(row.getCell(coluna.index).value);
    };

    for (let rowIndex = linhaCabecalho + 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const digitos = sanitizarCnpj(valorColuna(row, colunasResolvidas.cnpj));

      if (digitos.length !== 14 || cnpjRepetido(digitos)) {
        invalidos += 1;
        continue;
      }

      if (registrosPorCnpj.has(digitos)) {
        duplicados += 1;
      }

      const extras = { Aba: worksheet.name };
      colunas.forEach(coluna => {
        if (mapeados.has(coluna.nome)) return;
        const texto = textoCelula(row.getCell(coluna.index).value);
        if (texto) extras[coluna.nome] = texto;
      });

      registrosPorCnpj.set(digitos, {
        cnpj: formatarCnpj(digitos),
        cnpj_digitos: digitos,
        razao_social: valorColuna(row, colunasResolvidas.razao_social) || null,
        nome_fantasia: valorColuna(row, colunasResolvidas.nome_fantasia) || null,
        data_venda: parseDataVenda(valorColuna(row, colunasResolvidas.data_venda)),
        dados_extras: JSON.stringify(extras),
        lote,
        importado_por_id: usuarioId || null,
        importado_em: db.fn.now(),
        updated_at: db.fn.now()
      });
    }
  }

  const registros = Array.from(registrosPorCnpj.values());
  const unicos = registros.length;
  const ignorados = invalidos + duplicados;

  if (unicos === 0) {
    return {
      total: totalLinhas,
      unicos,
      inseridos: 0,
      atualizados: 0,
      ignorados,
      invalidos,
      duplicados,
      lote
    };
  }

  // Descobre quantos ja existem para separar inseridos de atualizados.
  const digitosLista = registros.map(r => r.cnpj_digitos);
  const jaExistentes = new Set();
  for (let i = 0; i < digitosLista.length; i += CHUNK) {
    const fatia = digitosLista.slice(i, i + CHUNK);
    const linhas = await db('vendas_antigas').whereIn('cnpj_digitos', fatia).select('cnpj_digitos');
    linhas.forEach(l => jaExistentes.add(l.cnpj_digitos));
  }

  await db.transaction(async trx => {
    for (let i = 0; i < registros.length; i += CHUNK) {
      const fatia = registros.slice(i, i + CHUNK);
      await trx('vendas_antigas')
        .insert(fatia)
        .onConflict('cnpj_digitos')
        .merge(['cnpj', 'razao_social', 'nome_fantasia', 'data_venda', 'dados_extras', 'lote', 'importado_por_id', 'importado_em', 'updated_at']);
    }
  });

  const atualizados = jaExistentes.size;
  return {
    total: totalLinhas,
    unicos,
    inseridos: unicos - atualizados,
    atualizados,
    ignorados,
    invalidos,
    duplicados,
    lote
  };
}

/**
 * Busca uma venda antiga por CNPJ e registra o historico da consulta.
 * Retorna apenas os campos essenciais (ou null quando nao encontrado).
 */
async function buscarPorCnpj(cnpjBruto, usuario) {
  const digitos = sanitizarCnpj(cnpjBruto);

  if (digitos.length !== 14 || cnpjRepetido(digitos)) {
    throw criarHttpError(400, 'Informe um CNPJ valido com 14 digitos.');
  }

  const registro = await VendaAntiga.query()
    .where('cnpj_digitos', digitos)
    .first();

  let usuarioNome = null;
  if (usuario?.id) {
    const dono = await Usuario.query().findById(usuario.id).select('nome');
    usuarioNome = dono?.nome || usuario.email || null;
  }

  await VendaAntigaBusca.query().insert({
    usuario_id: usuario?.id || null,
    usuario_nome: usuarioNome,
    cnpj_digitos: digitos,
    cnpj_formatado: formatarCnpj(digitos),
    encontrou: !!registro,
    buscado_em: db.fn.now()
  });

  if (!registro) return null;

  return {
    cnpj: registro.cnpj || formatarCnpj(digitos),
    razao_social: registro.razao_social || null,
    nome_fantasia: registro.nome_fantasia || null,
    data_venda: registro.data_venda || null
  };
}

/**
 * Lista paginada do historico de buscas (mais recentes primeiro).
 */
async function listarHistorico(filtros = {}) {
  const page = Math.max(Number(filtros.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(filtros.per_page) || 20, 1), 100);

  const query = VendaAntigaBusca.query()
    .select(
      'vendas_antigas_buscas.*'
    )
    .orderBy('buscado_em', 'desc');

  const busca = String(filtros.busca || '').trim();
  if (busca) {
    const digitos = busca.replace(/\D/g, '');
    query.where(builder => {
      builder.where('usuario_nome', 'like', `%${busca}%`);
      if (digitos) builder.orWhere('cnpj_digitos', 'like', `%${digitos}%`);
    });
  }

  const resultado = await query.page(page - 1, perPage);

  return {
    data: resultado.results,
    total: resultado.total,
    page,
    per_page: perPage
  };
}

module.exports = {
  previewPlanilha,
  importarPlanilha,
  buscarPorCnpj,
  listarHistorico
};
