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
const LIMITE_DETALHES_INVALIDOS = 200;
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

function digitosRepetidos(valor) {
  return /^(\d)\1+$/.test(valor);
}

/**
 * Descobre que documento a celula contem. CPF entra como documento proprio
 * porque `sanitizarCnpj` nao recupera 11 digitos (so completa 12 e 13).
 */
function classificarDocumento(valor) {
  const crus = String(valor || '').replace(/\D/g, '');

  if (crus.length === 11 && !digitosRepetidos(crus)) {
    return { tipo: 'cpf', digitos: crus };
  }

  const cnpj = sanitizarCnpj(valor);
  if (cnpj.length === 14 && !cnpjRepetido(cnpj)) {
    return { tipo: 'cnpj', digitos: cnpj };
  }

  return { tipo: 'sem_documento', digitos: '' };
}

/**
 * Normaliza a razao social para uso como chave de deduplicacao. Nao remove
 * sufixos societarios (LTDA/ME/EIRELI): empresas distintas poderiam se fundir.
 * Trunca em 180 porque `chave_dedup` e um indice unico de 191 em utf8mb4.
 */
function normalizarRazaoSocial(valor) {
  return normalizarTexto(valor).replace(/\s+/g, ' ').trim().slice(0, 180);
}

/**
 * Chave de upsert por precedencia: CNPJ, depois CPF, depois razao social.
 * Retorna null quando a linha nao tem documento nem nome - unico caso descartado.
 */
function montarChaveDedup(classificacao, razaoSocial) {
  if (classificacao.tipo === 'cnpj') return `cnpj:${classificacao.digitos}`;
  if (classificacao.tipo === 'cpf') return `cpf:${classificacao.digitos}`;

  const razao = normalizarRazaoSocial(razaoSocial);
  return razao ? `rs:${razao}` : null;
}

function formatarCnpj(valor) {
  const d = sanitizarCnpj(valor);
  if (d.length !== 14) return String(valor || '').trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatarCpf(digitos) {
  if (digitos.length !== 11) return digitos;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/**
 * Documento legivel de um registro ja gravado, seja CNPJ ou CPF.
 */
function formatarDocumento(registro) {
  if (registro.documento_tipo === 'cpf') return formatarCpf(registro.documento_digitos || '');
  if (registro.cnpj) return registro.cnpj;
  if (registro.cnpj_digitos) return formatarCnpj(registro.cnpj_digitos);
  return null;
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

  const registrosPorChave = new Map();
  const invalidosDetalhes = [];
  let invalidos = 0;
  let duplicados = 0;
  let semCnpj = 0;

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
      const valorDocumento = valorColuna(row, colunasResolvidas.cnpj);
      const razaoSocial = valorColuna(row, colunasResolvidas.razao_social) || null;

      const classificacao = classificarDocumento(valorDocumento);
      const chave = montarChaveDedup(classificacao, razaoSocial);

      if (!chave) {
        invalidos += 1;
        if (invalidosDetalhes.length < LIMITE_DETALHES_INVALIDOS) {
          invalidosDetalhes.push({
            aba: worksheet.name,
            linha: rowIndex,
            valor: valorDocumento,
            motivo: colunasResolvidas.razao_social
              ? 'Sem CNPJ/CPF e sem razao social'
              : 'Sem CNPJ/CPF e coluna de razao social nao mapeada'
          });
        }
        continue;
      }

      if (registrosPorChave.has(chave)) {
        duplicados += 1;
      } else if (classificacao.tipo !== 'cnpj') {
        semCnpj += 1;
      }

      const extras = { Aba: worksheet.name };
      colunas.forEach(coluna => {
        if (mapeados.has(coluna.nome)) return;
        const texto = textoCelula(row.getCell(coluna.index).value);
        if (texto) extras[coluna.nome] = texto;
      });

      const ehCnpj = classificacao.tipo === 'cnpj';
      registrosPorChave.set(chave, {
        chave_dedup: chave,
        cnpj: ehCnpj ? formatarCnpj(classificacao.digitos) : null,
        cnpj_digitos: ehCnpj ? classificacao.digitos : null,
        documento_digitos: classificacao.digitos || null,
        documento_tipo: classificacao.tipo,
        razao_social: razaoSocial,
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

  const registros = Array.from(registrosPorChave.values());
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
      invalidos_detalhes: invalidosDetalhes,
      duplicados,
      sem_cnpj: semCnpj,
      lote
    };
  }

  // Descobre quantos ja existem para separar inseridos de atualizados.
  const chavesLista = registros.map(r => r.chave_dedup);
  const jaExistentes = new Set();
  for (let i = 0; i < chavesLista.length; i += CHUNK) {
    const fatia = chavesLista.slice(i, i + CHUNK);
    const linhas = await db('vendas_antigas').whereIn('chave_dedup', fatia).select('chave_dedup');
    linhas.forEach(l => jaExistentes.add(l.chave_dedup));
  }

  await db.transaction(async trx => {
    for (let i = 0; i < registros.length; i += CHUNK) {
      const fatia = registros.slice(i, i + CHUNK);
      await trx('vendas_antigas')
        .insert(fatia)
        .onConflict('chave_dedup')
        .merge(['cnpj', 'cnpj_digitos', 'documento_digitos', 'documento_tipo', 'razao_social', 'nome_fantasia', 'data_venda', 'dados_extras', 'lote', 'importado_por_id', 'importado_em', 'updated_at']);
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
    invalidos_detalhes: invalidosDetalhes,
    duplicados,
    sem_cnpj: semCnpj,
    lote
  };
}

/**
 * Projecao enxuta de uma venda antiga para a tela de busca.
 */
function projetarVenda(registro) {
  return {
    cnpj: formatarDocumento(registro),
    documento_tipo: registro.documento_tipo || 'cnpj',
    razao_social: registro.razao_social || null,
    nome_fantasia: registro.nome_fantasia || null,
    data_venda: registro.data_venda || null
  };
}

async function resolverNomeUsuario(usuario) {
  if (!usuario?.id) return null;
  const dono = await Usuario.query().findById(usuario.id).select('nome');
  return dono?.nome || usuario.email || null;
}

/**
 * Busca por documento (CNPJ/CPF, match exato) ou por razao social (LIKE parcial,
 * paginado). Registra o historico da consulta nos dois casos.
 */
async function buscar(termoBruto, usuario, filtros = {}) {
  const termo = String(termoBruto || '').trim();
  const digitosCrus = termo.replace(/\D/g, '');
  const somenteDocumento = termo.replace(/[0-9.\-/\s]/g, '') === '';

  const page = Math.max(Number(filtros.page) || 1, 1);
  const perPage = Math.min(Math.max(Number(filtros.per_page) || 20, 1), 100);

  // Documento so quando o texto nao tem letras: "12 de maio" nao e um CNPJ.
  const classificacao = somenteDocumento ? classificarDocumento(termo) : { tipo: 'sem_documento', digitos: '' };
  const porDocumento = classificacao.tipo !== 'sem_documento';

  if (!porDocumento) {
    if (somenteDocumento && digitosCrus) {
      throw criarHttpError(400, 'Informe um CNPJ (14 digitos) ou CPF (11 digitos) valido.');
    }
    if (termo.length < 3) {
      throw criarHttpError(400, 'Informe um CNPJ, um CPF ou ao menos 3 letras da razao social.');
    }
  }

  let venda = null;
  let resultados = [];
  let total = 0;

  if (porDocumento) {
    const coluna = classificacao.tipo === 'cnpj' ? 'cnpj_digitos' : 'documento_digitos';
    const registro = await VendaAntiga.query().where(coluna, classificacao.digitos).first();
    if (registro) {
      venda = projetarVenda(registro);
      total = 1;
    }
  } else {
    const like = `%${termo}%`;
    const pagina = await VendaAntiga.query()
      .where(builder => {
        builder.where('razao_social', 'like', like).orWhere('nome_fantasia', 'like', like);
      })
      .orderBy('razao_social', 'asc')
      .page(page - 1, perPage);

    resultados = pagina.results.map(projetarVenda);
    total = pagina.total;
  }

  const encontrado = porDocumento ? !!venda : resultados.length > 0;

  await VendaAntigaBusca.query().insert({
    usuario_id: usuario?.id || null,
    usuario_nome: await resolverNomeUsuario(usuario),
    termo,
    tipo_busca: porDocumento ? classificacao.tipo : 'nome',
    cnpj_digitos: classificacao.tipo === 'cnpj' ? classificacao.digitos : null,
    cnpj_formatado: classificacao.tipo === 'cnpj' ? formatarCnpj(classificacao.digitos) : null,
    encontrou: encontrado,
    buscado_em: db.fn.now()
  });

  return {
    tipo: porDocumento ? 'documento' : 'nome',
    encontrado,
    venda,
    resultados,
    total,
    page,
    per_page: perPage
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
      builder.where('usuario_nome', 'like', `%${busca}%`)
        .orWhere('termo', 'like', `%${busca}%`);
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
  buscar,
  listarHistorico
};
