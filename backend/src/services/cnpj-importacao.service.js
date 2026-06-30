const Busboy = require('busboy');
const ExcelJS = require('exceljs');
const cnpjService = require('./cnpj.service');
const clienteService = require('./cliente.service');
const googlePlacesService = require('./google-places.service');

const INTERVALO_CONSULTA_MS = Number(process.env.CNPJ_IMPORT_INTERVALO_MS || 21000);
const LIMITE_LINHAS = Number(process.env.CNPJ_IMPORT_LIMITE_LINHAS || 50);
const COLUNAS_EXPORTACAO = [
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Mensagem', key: 'message', width: 32 },
  { header: 'CNPJ', key: 'cnpj', width: 20 },
  { header: 'Razao social', key: 'razao_social', width: 36 },
  { header: 'Nome fantasia', key: 'nome_fantasia', width: 28 },
  { header: 'Situacao', key: 'situacao_cadastral', width: 18 },
  { header: 'E-mail', key: 'email', width: 28 },
  { header: 'Telefone', key: 'telefone', width: 18 },
  { header: 'Tel. Open CNPJ', key: 'telefone_open_cnpj', width: 18 },
  { header: 'Tel. CNPJ.ws', key: 'telefone_cnpjws', width: 18 },
  { header: 'Tel. Minha Receita', key: 'telefone_minha_receita', width: 18 },
  { header: 'Tel. Google', key: 'telefone_google_places', width: 18 },
  { header: 'Google status', key: 'google_status', width: 18 },
  { header: 'Google detalhe', key: 'google_detalhe', width: 32 },
  { header: 'Fonte telefone', key: 'telefone_fonte', width: 18 },
  { header: 'Conf. telefone', key: 'telefone_confianca', width: 16 },
  { header: 'CEP', key: 'cep', width: 14 },
  { header: 'Endereco', key: 'endereco', width: 34 },
  { header: 'Numero', key: 'numero', width: 12 },
  { header: 'Complemento', key: 'complemento', width: 22 },
  { header: 'Bairro', key: 'bairro', width: 22 },
  { header: 'Municipio', key: 'municipio', width: 22 },
  { header: 'UF', key: 'uf', width: 8 },
  { header: 'Fontes', key: 'fontes', width: 28 },
  { header: 'Adicionado', key: 'adicionado', width: 14 }
];

function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return String(valor).trim();
  if (Array.isArray(valor.richText)) return valor.richText.map(item => item.text || '').join('').trim();
  if (valor.text) return String(valor.text).trim();
  if (valor.result !== undefined) return textoCelula(valor.result);
  return String(valor).trim();
}

function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarCnpj(valor) {
  const digitos = sanitizarCnpj(valor);
  if (digitos.length !== 14) return String(valor || '').trim();
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function separarTelefone(valor) {
  const bruto = String(valor || '').replace(/\D/g, '');
  const digitos = bruto.startsWith('55') && bruto.length > 11
    ? bruto.slice(2, 13)
    : bruto.slice(0, 11);
  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'consulta-cnpj';
}

function lerArquivoMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const campos = {};
    const chunks = [];
    let arquivo = null;

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      arquivo = {
        fieldname: name,
        filename: info.filename,
        mimeType: info.mimeType
      };

      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(criarHttpError(400, 'Arquivo excede o limite permitido.')));
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!arquivo || chunks.length === 0) {
        reject(criarHttpError(400, 'Envie uma planilha XLSX.'));
        return;
      }

      if (!String(arquivo.filename || '').toLowerCase().endsWith('.xlsx')) {
        reject(criarHttpError(400, 'Envie um arquivo .xlsx.'));
        return;
      }

      resolve({
        arquivo: {
          ...arquivo,
          buffer: Buffer.concat(chunks)
        },
        campos
      });
    });

    req.pipe(busboy);
  });
}

async function lerWorksheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw criarHttpError(400, 'A planilha nao possui abas.');
  return worksheet;
}

function obterCabecalhos(worksheet) {
  const header = worksheet.getRow(1);
  const colunas = [];

  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    const nome = textoCelula(header.getCell(col).value);
    if (nome) colunas.push({ nome, index: col });
  }

  if (colunas.length === 0) {
    throw criarHttpError(400, 'Nao foi possivel identificar cabecalhos na primeira linha.');
  }

  return colunas;
}

function sugerirColunaCnpj(colunas) {
  const encontrada = colunas.find(coluna => normalizarTexto(coluna.nome).includes('cnpj'));
  return encontrada?.nome || '';
}

function montarAmostras(worksheet, colunas) {
  const amostras = [];
  const limite = Math.min(worksheet.rowCount, 6);

  for (let rowIndex = 2; rowIndex <= limite; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const dados = {};
    colunas.forEach(coluna => {
      dados[coluna.nome] = textoCelula(row.getCell(coluna.index).value);
    });
    amostras.push({ row_index: rowIndex, dados });
  }

  return amostras;
}

async function previewPlanilha(req) {
  const { arquivo } = await lerArquivoMultipart(req);
  const worksheet = await lerWorksheet(arquivo.buffer);
  const colunas = obterCabecalhos(worksheet);

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_linhas: Math.max(worksheet.rowCount - 1, 0),
    limite_linhas: LIMITE_LINHAS,
    colunas,
    sugestoes: {
      cnpj: sugerirColunaCnpj(colunas)
    },
    amostras: montarAmostras(worksheet, colunas)
  };
}

function parseMapeamento(valor) {
  if (!valor) return {};
  if (typeof valor === 'object') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return {};
  }
}

function normalizarInteiroPositivo(valor, fallback) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return numero;
}

function extrairCnpjs(worksheet, colunaCnpj) {
  const colunas = obterCabecalhos(worksheet);
  const headerMap = new Map(colunas.map(coluna => [coluna.nome, coluna.index]));
  const colunaIndex = headerMap.get(colunaCnpj);
  if (!colunaIndex) throw criarHttpError(400, 'Selecione uma coluna de CNPJ valida.');

  const vistos = new Set();
  const linhas = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const cnpj = sanitizarCnpj(textoCelula(worksheet.getRow(rowIndex).getCell(colunaIndex).value));
    if (cnpj.length !== 14 || vistos.has(cnpj)) continue;
    vistos.add(cnpj);
    linhas.push({ row_index: rowIndex, cnpj });
  }

  if (linhas.length === 0) {
    throw criarHttpError(400, 'Nenhum CNPJ valido foi encontrado na coluna selecionada.');
  }

  return linhas;
}

function montarLinhaConsulta(item, dados) {
  const telefonesPorFonte = montarTelefonesPorFonte(dados);

  return {
    row_index: item.row_index,
    status: 'encontrado',
    cnpj: formatarCnpj(item.cnpj),
    cnpj_digitos: item.cnpj,
    razao_social: dados.razaoSocial || '',
    nome_fantasia: dados.nomeFantasia || '',
    situacao_cadastral: dados.situacaoCadastral || '',
    email: dados.email || '',
    telefone: dados.telefone || '',
    telefone_open_cnpj: telefonesPorFonte.openCnpj,
    telefone_cnpjws: telefonesPorFonte.cnpjws,
    telefone_minha_receita: telefonesPorFonte.minhaReceita,
    telefone_google_places: telefonesPorFonte.googlePlaces,
    google_status: dados.googlePlaces?.encontrado
      ? 'encontrado'
      : dados.googlePlaces?.motivo || '',
    google_detalhe: dados.googlePlaces?.encontrado
      ? dados.googlePlaces?.place?.nome || ''
      : dados.googlePlaces?.message || dados.googlePlaces?.motivo || '',
    telefone_fonte: dados.telefoneFonte || (dados.telefone ? dados.fontesPorCampo?.telefone?.fonte || dados.fonte || '' : ''),
    telefone_confianca: dados.telefoneConfianca || dados.fontesPorCampo?.telefone?.confianca || '',
    cep: dados.cep || '',
    endereco: dados.endereco || '',
    numero: dados.numero || '',
    complemento: dados.complemento || '',
    bairro: dados.bairro || '',
    municipio: dados.municipio || '',
    uf: dados.uf || '',
    fontes: dados.fontesComSucesso || [],
    fontes_com_erro: dados.fontesComErro || [],
    fontes_por_campo: dados.fontesPorCampo || {},
    alertas: dados.alertas || [],
    google_places: dados.googlePlaces || null,
    cache: Boolean(dados.cache),
    consultado_em: dados.consultadoEm || null,
    cliente_id: null,
    adicionado: false
  };
}

function montarTelefonesPorFonte(dados = {}) {
  const telefones = {
    openCnpj: '',
    cnpjws: '',
    minhaReceita: '',
    googlePlaces: dados.googlePlaces?.encontrado ? dados.googlePlaces.telefone || '' : ''
  };

  const porFonte = {
    'Open CNPJ': 'openCnpj',
    CNPJws: 'cnpjws',
    'Minha Receita': 'minhaReceita',
    'Google Places': 'googlePlaces'
  };

  (dados.alternativasPorCampo?.telefone || []).forEach(item => {
    const chave = porFonte[item.fonte];
    if (chave && item.valor && !telefones[chave]) {
      telefones[chave] = item.valor;
    }
  });

  const fontePrincipal = dados.telefoneFonte || dados.fontesPorCampo?.telefone?.fonte || dados.fonte || '';
  const chavePrincipal = porFonte[fontePrincipal];
  if (chavePrincipal && dados.telefone && !telefones[chavePrincipal]) {
    telefones[chavePrincipal] = dados.telefone;
  }

  return telefones;
}

async function enriquecerTelefoneGoogle(dados, modoGoogle = 'sem_telefone') {
  if (modoGoogle === 'nao') {
    return {
      ...dados,
      googlePlaces: {
        encontrado: false,
        motivo: 'desativado'
      }
    };
  }

  if (modoGoogle === 'sem_telefone' && String(dados?.telefone || '').trim()) {
    return {
      ...dados,
      googlePlaces: {
        encontrado: false,
        motivo: 'ignorado_com_telefone'
      }
    };
  }

  const resultado = await googlePlacesService.buscarTelefoneEmpresa(dados);
  if (!resultado.encontrado) {
    if (String(dados?.telefone || '').trim()) {
      return {
        ...dados,
        googlePlaces: resultado
      };
    }

    return {
      ...dados,
      googlePlaces: resultado,
      alertas: [
        ...(dados.alertas || []),
        {
          tipo: 'telefone_google',
          campo: 'telefone',
          mensagem: resultado.motivo === 'sem_chave'
            ? 'Google Places nao configurado para buscar telefone.'
            : 'Telefone nao encontrado no Google Places.'
        }
      ]
    };
  }

  return {
    ...dados,
    telefone: dados.telefone || resultado.telefone,
    telefoneFonte: dados.telefone ? dados.telefoneFonte : resultado.fonte,
    telefoneConfianca: dados.telefone ? dados.telefoneConfianca : resultado.confianca,
    googlePlaces: resultado,
    fontesComSucesso: Array.from(new Set([...(dados.fontesComSucesso || []), resultado.fonte])),
    fontesPorCampo: {
      ...(dados.fontesPorCampo || {}),
      telefone: dados.telefone
        ? dados.fontesPorCampo?.telefone
        : {
            fonte: resultado.fonte,
            atualizadoEm: null,
            confianca: resultado.confianca,
            divergente: false
          }
    },
    alternativasPorCampo: {
      ...(dados.alternativasPorCampo || {}),
      telefone: [
        ...(dados.alternativasPorCampo?.telefone || []),
        {
          fonte: resultado.fonte,
          valor: resultado.telefone,
          atualizadoEm: null
        }
      ]
    }
  };
}

async function consultarPlanilha(req) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const worksheet = await lerWorksheet(arquivo.buffer);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const modoGoogle = ['sem_telefone', 'nao'].includes(mapeamento.google)
    ? mapeamento.google
    : 'sem_telefone';

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna de CNPJ.');
  }

  const cnpjsTodos = extrairCnpjs(worksheet, mapeamento.cnpj);
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha CNPJs pendentes nesse lote.');
  }

  const linhas = [];
  let requisicoesExternas = 0;
  const proximoInicio = inicio + cnpjs.length;

  for (const [index, item] of cnpjs.entries()) {
    try {
      const dados = await enriquecerTelefoneGoogle(await cnpjService.consultarCnpj(item.cnpj), modoGoogle);
      if (!dados.cache) requisicoesExternas += 1;
      linhas.push(montarLinhaConsulta(item, dados));
      if (!dados.cache && index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      linhas.push({
        row_index: item.row_index,
        status: 'erro',
        cnpj: formatarCnpj(item.cnpj),
        cnpj_digitos: item.cnpj,
        message: error.message || 'Erro ao consultar CNPJ.',
        code: error.code || 'erro',
        adicionado: false
      });
      if (index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    }
  }

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_cnpjs: cnpjsTodos.length,
    inicio,
    limite,
    proximo_inicio: proximoInicio < cnpjsTodos.length ? proximoInicio : null,
    tem_proximo_lote: proximoInicio < cnpjsTodos.length,
    total_consultados: linhas.length,
    requisicoes_externas: requisicoesExternas,
    intervalo_ms: INTERVALO_CONSULTA_MS,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita'],
    colunas_normalizadas: [
      'cnpj',
      'razao_social',
      'nome_fantasia',
      'situacao_cadastral',
      'email',
      'telefone',
      'telefone_open_cnpj',
      'telefone_cnpjws',
      'telefone_minha_receita',
      'telefone_google_places',
      'google_status',
      'google_detalhe',
      'telefone_fonte',
      'telefone_confianca',
      'cep',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'municipio',
      'uf'
    ],
    linhas
  };
}

async function consultarPlanilhaStream(req, onEvento) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const worksheet = await lerWorksheet(arquivo.buffer);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const modoGoogle = ['sem_telefone', 'nao'].includes(mapeamento.google)
    ? mapeamento.google
    : 'sem_telefone';

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna de CNPJ.');
  }

  const cnpjsTodos = extrairCnpjs(worksheet, mapeamento.cnpj);
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha CNPJs pendentes nesse lote.');
  }

  const proximoInicio = inicio + cnpjs.length;
  const meta = {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_cnpjs: cnpjsTodos.length,
    inicio,
    limite,
    proximo_inicio: proximoInicio < cnpjsTodos.length ? proximoInicio : null,
    tem_proximo_lote: proximoInicio < cnpjsTodos.length,
    total_lote: cnpjs.length,
    intervalo_ms: INTERVALO_CONSULTA_MS,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita'],
    colunas_normalizadas: [
      'cnpj',
      'razao_social',
      'nome_fantasia',
      'situacao_cadastral',
      'email',
      'telefone',
      'telefone_open_cnpj',
      'telefone_cnpjws',
      'telefone_minha_receita',
      'telefone_google_places',
      'google_status',
      'google_detalhe',
      'telefone_fonte',
      'telefone_confianca',
      'cep',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'municipio',
      'uf'
    ]
  };
  let requisicoesExternas = 0;

  await onEvento({ tipo: 'inicio', ...meta });

  for (const [index, item] of cnpjs.entries()) {
    await onEvento({
      tipo: 'progresso',
      atual: index + 1,
      total_lote: cnpjs.length,
      cnpj: formatarCnpj(item.cnpj),
      cnpj_digitos: item.cnpj
    });

    try {
      const dados = await enriquecerTelefoneGoogle(await cnpjService.consultarCnpj(item.cnpj), modoGoogle);
      if (!dados.cache) requisicoesExternas += 1;
      await onEvento({
        tipo: 'linha',
        linha: montarLinhaConsulta(item, dados),
        requisicoes_externas: requisicoesExternas
      });

      if (!dados.cache && index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      await onEvento({
        tipo: 'linha',
        linha: {
          row_index: item.row_index,
          status: 'erro',
          cnpj: formatarCnpj(item.cnpj),
          cnpj_digitos: item.cnpj,
          message: error.message || 'Erro ao consultar CNPJ.',
          code: error.code || 'erro',
          adicionado: false
        },
        requisicoes_externas: requisicoesExternas
      });

      if (index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    }
  }

  await onEvento({
    tipo: 'fim',
    ...meta,
    total_consultados: cnpjs.length,
    requisicoes_externas: requisicoesExternas
  });
}

function montarPayloadCliente(linha) {
  const telefone = separarTelefone(linha.telefone);
  const nome = linha.razao_social || linha.nome_fantasia || linha.cnpj;

  return {
    nome,
    razao_social: linha.razao_social || null,
    cnpj: linha.cnpj || linha.cnpj_digitos,
    responsavel_tipo: 'rl',
    email: linha.email || null,
    fixo_ddd: telefone.ddd,
    fixo_numero: telefone.numero
  };
}

async function adicionarClientes(linhas = [], usuarioId) {
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma linha consultada.');
  }

  const resultado = {
    criados: 0,
    ignorados: 0,
    erros: [],
    clientes: []
  };
  const vistos = new Set();

  for (const linha of linhas) {
    const cnpj = sanitizarCnpj(linha?.cnpj_digitos || linha?.cnpj);
    if (cnpj.length !== 14 || vistos.has(cnpj)) {
      resultado.ignorados += 1;
      continue;
    }
    vistos.add(cnpj);

    try {
      const criado = await clienteService.criarCliente(montarPayloadCliente({ ...linha, cnpj_digitos: cnpj }), usuarioId);
      resultado.criados += 1;
      resultado.clientes.push({
        id: criado.id,
        cnpj_digitos: cnpj
      });
    } catch (error) {
      resultado.erros.push({
        cnpj: formatarCnpj(cnpj),
        message: error.message || 'Erro ao adicionar cliente.'
      });
    }
  }

  return resultado;
}

function valorExportacao(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Nao';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
}

async function gerarXlsxResultado(linhas = [], opcoes = {}) {
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw criarHttpError(400, 'Nao ha resultados para exportar.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pos-venda';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Consulta CNPJ');
  worksheet.columns = COLUNAS_EXPORTACAO;

  linhas.forEach(linha => {
    worksheet.addRow(COLUNAS_EXPORTACAO.reduce((acc, coluna) => ({
      ...acc,
      [coluna.key]: valorExportacao(linha?.[coluna.key])
    }), {}));
  });

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle' };
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUNAS_EXPORTACAO.length }
  };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const data = new Date().toISOString().slice(0, 10);
  const base = nomeArquivoSeguro(opcoes.nome || `consulta-cnpj-${data}`);

  return {
    buffer,
    nome: `${base}.xlsx`
  };
}

module.exports = {
  adicionarClientes,
  consultarPlanilha,
  consultarPlanilhaStream,
  gerarXlsxResultado,
  previewPlanilha
};
