const Cliente = require('../models/Cliente');
const ClienteOperadora = require('../models/ClienteOperadora');
const Venda = require('../models/Venda');
const Usuario = require('../models/Usuario');
const Operadora = require('../models/Operadora');
const Busboy = require('busboy');
const ExcelJS = require('exceljs');
const notificacaoService = require('./notificacao.service');

const CAMPOS = [
  'nome',
  'razao_social',
  'cnpj',
  'responsavel_tipo',
  'responsavel_nome',
  'email',
  'whatsapp_ddd',
  'whatsapp_numero',
  'fixo_ddd',
  'fixo_numero',
  'fidelidade_fim',
  'operadora_atual_id',
  'valor_pago',
  'quantidade_chips',
  'base_anterior_sistema'
];

function limparValor(valor) {
  if (valor === undefined) return undefined;
  if (valor === '') return null;
  return valor;
}

function normalizarData(valor) {
  if (!valor) return null;

  const texto = String(valor).trim();

  if (!texto || texto === '1899-11-30' || texto === '30/11/1899') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (!match) return null;

  const [, dia, mes, ano] = match;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    data.getUTCFullYear(),
    pad(data.getUTCMonth() + 1),
    pad(data.getUTCDate())
  ].join('-') + ' ' + [
    pad(data.getUTCHours()),
    pad(data.getUTCMinutes()),
    pad(data.getUTCSeconds())
  ].join(':');
}

function adicionarUmMes(data = new Date()) {
  const proxima = new Date(data);
  proxima.setMonth(proxima.getMonth() + 1);
  return proxima;
}

function separarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) {
    return { ddd: null, numero: null };
  }

  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function normalizarValorMonetario(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).trim();
  if (!texto) return null;

  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarCnpj(valor) {
  const digitos = sanitizarCnpj(valor);
  if (digitos.length !== 14) return String(valor || '').trim();
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function normalizarCnpjObrigatorio(valor) {
  const digitos = sanitizarCnpj(valor);

  if (digitos.length !== 14) {
    throw criarHttpError(400, 'Informe um CNPJ com 14 digitos.');
  }

  return {
    cnpj: formatarCnpj(digitos),
    cnpj_digitos: digitos
  };
}

function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return String(valor).trim();
  if (Array.isArray(valor.richText)) {
    return valor.richText.map(item => item.text || '').join('').trim();
  }
  if (valor.text) return String(valor.text).trim();
  if (valor.result !== undefined) return textoCelula(valor.result);
  if (valor.hyperlink && valor.text) return String(valor.text).trim();
  return String(valor).trim();
}

function obterValorLinha(row, headerMap, coluna) {
  if (!coluna) return '';
  const index = headerMap.get(coluna);
  if (!index) return '';
  return textoCelula(row.getCell(index).value);
}

function somarNumero(valor) {
  const numero = normalizarValorMonetario(valor);
  return numero === null ? 0 : numero;
}

function normalizarInteiro(valor) {
  const numero = Number(String(valor || '').replace(/\D/g, ''));
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarInteiroOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.max(Math.trunc(numero), 0);
}

function normalizarOperadorasCliente(dados = {}) {
  const fonte = Array.isArray(dados.operadoras_atuais)
    ? dados.operadoras_atuais
    : Array.isArray(dados.operadorasAtuais)
      ? dados.operadorasAtuais
      : null;

  const linhas = fonte || (
    dados.operadora_atual_id || dados.quantidade_chips !== undefined || dados.valor_pago !== undefined || dados.fidelidade_fim !== undefined
      ? [{
        operadora_id: dados.operadora_atual_id,
        quantidade_chips: dados.quantidade_chips,
        valor_pago: dados.valor_pago,
        fidelidade_fim: dados.fidelidade_fim
      }]
      : []
  );

  const porOperadora = new Map();

  linhas.forEach(item => {
    const operadoraId = Number(item?.operadora_id || item?.operadora?.id || item?.id_operadora);
    if (!Number.isFinite(operadoraId) || operadoraId <= 0) return;

    const atual = porOperadora.get(operadoraId) || {
      operadora_id: operadoraId,
      quantidade_chips: 0,
      valor_pago: 0,
      fidelidade_fim: null
    };
    const quantidade = normalizarInteiroOpcional(item.quantidade_chips);
    const valor = normalizarValorMonetario(item.valor_pago);
    const fidelidade = normalizarData(item.fidelidade_fim);

    if (quantidade !== null) {
      atual.quantidade_chips += quantidade;
    }

    if (valor !== null) {
      atual.valor_pago = Number((Number(atual.valor_pago || 0) + Number(valor)).toFixed(2));
    }

    if (fidelidade && (!atual.fidelidade_fim || fidelidade < atual.fidelidade_fim)) {
      atual.fidelidade_fim = fidelidade;
    }

    porOperadora.set(operadoraId, atual);
  });

  return Array.from(porOperadora.values()).map(item => ({
    ...item,
    quantidade_chips: item.quantidade_chips > 0 ? item.quantidade_chips : null,
    valor_pago: item.valor_pago > 0 ? item.valor_pago : null
  }));
}

function ordenarOperadorasCliente(operadoras = []) {
  return [...operadoras].sort((a, b) => (
    Number(a.id || 0) - Number(b.id || 0)
    || Number(a.operadora_id || 0) - Number(b.operadora_id || 0)
  ));
}

function obterResumoOperadorasCliente(operadoras = []) {
  const ordenadas = ordenarOperadorasCliente(operadoras);
  const primeira = ordenadas[0] || null;
  const quantidade = ordenadas.reduce((total, item) => total + Number(item.quantidade_chips || 0), 0);
  const valor = ordenadas.reduce((total, item) => total + Number(item.valor_pago || 0), 0);
  const fidelidades = ordenadas
    .map(item => normalizarData(item.fidelidade_fim))
    .filter(Boolean)
    .sort();

  return {
    operadora_atual_id: primeira?.operadora_id || null,
    operadoraAtual: primeira?.operadora || null,
    quantidade_chips: quantidade > 0 ? quantidade : null,
    valor_pago: valor > 0 ? Number(valor.toFixed(2)) : null,
    fidelidade_fim: fidelidades[0] || null
  };
}

function formatarOperadorasCliente(operadoras = []) {
  return ordenarOperadorasCliente(operadoras).map(item => ({
    id: item.id,
    cliente_id: item.cliente_id,
    operadora_id: item.operadora_id,
    operadora: item.operadora || null,
    quantidade_chips: item.quantidade_chips ?? null,
    valor_pago: item.valor_pago ?? null,
    fidelidade_fim: item.fidelidade_fim || null,
    aviso_fidelidade: montarAvisoFidelidade({ fidelidade_fim: item.fidelidade_fim })
  }));
}

async function sincronizarOperadorasCliente(clienteId, operadoras, trx = null) {
  const clienteIdNormalizado = Number(clienteId);
  const linhas = normalizarOperadorasCliente({ operadoras_atuais: operadoras });

  await ClienteOperadora.query(trx)
    .delete()
    .where('cliente_id', clienteIdNormalizado);

  if (linhas.length > 0) {
    await ClienteOperadora.query(trx).insert(linhas.map(item => ({
      ...item,
      cliente_id: clienteIdNormalizado,
      operadora_id: Number(item.operadora_id)
    })));
  }

  await atualizarResumoLegadoCliente(clienteIdNormalizado, trx);
}

async function atualizarResumoLegadoCliente(clienteId, trx = null) {
  const clienteIdNormalizado = Number(clienteId);
  const operadoras = await ClienteOperadora.query(trx)
    .where('cliente_id', clienteIdNormalizado)
    .withGraphFetched('operadora')
    .orderBy('id', 'asc');
  const resumo = obterResumoOperadorasCliente(operadoras);

  await Cliente.query(trx).patchAndFetchById(clienteIdNormalizado, {
    operadora_atual_id: resumo.operadora_atual_id,
    quantidade_chips: resumo.quantidade_chips,
    valor_pago: resumo.valor_pago,
    fidelidade_fim: resumo.fidelidade_fim,
    updated_at: new Date()
  });

  return resumo;
}

function escolherTexto(...valores) {
  return valores.find(valor => String(valor || '').trim()) || '';
}

function complementarCampo(payload, cliente, campo, valor) {
  if (cliente[campo] === null || cliente[campo] === undefined || cliente[campo] === '') {
    payload[campo] = valor || null;
  }
}

function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizarPaginacao(filtros = {}) {
  const opcoesPorPagina = new Set([20, 50, 100]);
  const page = Math.max(Number.parseInt(filtros.page, 10) || 1, 1);
  const perPageInformado = Number.parseInt(filtros.per_page, 10);
  const perPage = opcoesPorPagina.has(perPageInformado) ? perPageInformado : 20;
  return { page, perPage };
}

function lerArquivoMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const partes = {};
    const chunks = [];
    let arquivo = null;

    busboy.on('field', (name, value) => {
      partes[name] = value;
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

      const filename = String(arquivo.filename || '').toLowerCase();
      if (!filename.endsWith('.xlsx')) {
        reject(criarHttpError(400, 'Envie um arquivo .xlsx.'));
        return;
      }

      resolve({
        arquivo: {
          ...arquivo,
          buffer: Buffer.concat(chunks)
        },
        campos: partes
      });
    });

    req.pipe(busboy);
  });
}

async function lerWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw criarHttpError(400, 'A planilha nao possui abas.');
  }
  return worksheet;
}

function obterCabecalhos(worksheet) {
  const headerRow = worksheet.getRow(1);
  const colunas = [];

  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    const nome = textoCelula(headerRow.getCell(col).value);
    if (nome) {
      colunas.push({ nome, index: col });
    }
  }

  if (colunas.length === 0) {
    throw criarHttpError(400, 'Não foi possível identificar cabeçalhos na primeira linha.');
  }

  return colunas;
}

function sugerirMapeamento(colunas) {
  const porTexto = new Map(colunas.map(coluna => [normalizarTexto(coluna.nome), coluna.nome]));

  function achar(...termos) {
    const termosNorm = termos.map(normalizarTexto);
    for (const [texto, nome] of porTexto.entries()) {
      if (termosNorm.some(termo => texto === termo || texto.includes(termo))) {
        return nome;
      }
    }
    return '';
  }

  const razaoSocial = achar('razao social', 'razão social');

  return {
    cnpj: achar('cnpj'),
    nome: razaoSocial,
    razao_social: razaoSocial,
    responsavel_nome: achar('rl', 'responsavel', 'responsável'),
    email: achar('e-mail', 'email'),
    whatsapp: achar('numero whatsapp', 'número whatsapp', 'whatsapp'),
    fixo: achar('fixo', 'telefone fixo'),
    quantidade_chips: achar('quantidade', 'qtd'),
    valor_pago: achar('receita contratada', 'valor'),
    operadora_atual: achar('operadora')
  };
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

async function previewImportacaoBaseAnterior(req) {
  const { arquivo } = await lerArquivoMultipart(req);
  const worksheet = await lerWorkbook(arquivo.buffer);
  const colunas = obterCabecalhos(worksheet);

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_linhas: Math.max(worksheet.rowCount - 1, 0),
    colunas,
    sugestoes: sugerirMapeamento(colunas),
    amostras: montarAmostras(worksheet, colunas)
  };
}

async function montarMapaOperadoras(trx = null) {
  const operadoras = await Operadora.query(trx).select('id', 'nome');
  return new Map(operadoras.map(operadora => [normalizarTexto(operadora.nome), operadora]));
}

function consolidarLinhasImportacao(worksheet, mapeamento, operadorasPorNome) {
  const colunas = obterCabecalhos(worksheet);
  const headerMap = new Map(colunas.map(coluna => [coluna.nome, coluna.index]));
  const resultado = {
    linhas_lidas: Math.max(worksheet.rowCount - 1, 0),
    linhas_ignoradas: 0,
    cnpjs_unicos: 0,
    operadoras_nao_encontradas: [],
    erros: []
  };
  const porCnpj = new Map();
  const operadorasNaoEncontradas = new Set();

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const cnpjDigitos = sanitizarCnpj(obterValorLinha(row, headerMap, mapeamento.cnpj));

    if (cnpjDigitos.length !== 14) {
      resultado.linhas_ignoradas += 1;
      resultado.erros.push({
        row_index: rowIndex,
        message: 'Linha ignorada por CNPJ ausente ou incompleto.'
      });
      continue;
    }

    const atual = porCnpj.get(cnpjDigitos) || {
      cnpj_digitos: cnpjDigitos,
      cnpj: formatarCnpj(cnpjDigitos),
      nome: '',
      razao_social: '',
      responsavel_nome: '',
      email: '',
      whatsapp: '',
      fixo: '',
      quantidade_chips: 0,
      valor_pago: 0,
      operadora_atual_id: null,
      operadoras_atuais: []
    };

    atual.nome = escolherTexto(atual.nome, obterValorLinha(row, headerMap, mapeamento.nome));
    atual.razao_social = escolherTexto(atual.razao_social, obterValorLinha(row, headerMap, mapeamento.razao_social));
    atual.responsavel_nome = escolherTexto(atual.responsavel_nome, obterValorLinha(row, headerMap, mapeamento.responsavel_nome));
    atual.email = escolherTexto(atual.email, obterValorLinha(row, headerMap, mapeamento.email));
    atual.whatsapp = escolherTexto(atual.whatsapp, obterValorLinha(row, headerMap, mapeamento.whatsapp));
    atual.fixo = escolherTexto(atual.fixo, obterValorLinha(row, headerMap, mapeamento.fixo));
    const quantidadeLinha = normalizarInteiro(obterValorLinha(row, headerMap, mapeamento.quantidade_chips));
    const valorLinha = somarNumero(obterValorLinha(row, headerMap, mapeamento.valor_pago));
    atual.quantidade_chips += quantidadeLinha;
    atual.valor_pago += valorLinha;

    const operadoraTexto = obterValorLinha(row, headerMap, mapeamento.operadora_atual);
    if (operadoraTexto) {
      const operadora = operadorasPorNome.get(normalizarTexto(operadoraTexto));
      if (operadora) {
        atual.operadora_atual_id = atual.operadora_atual_id || operadora.id;
        const operadoraAtual = atual.operadoras_atuais.find(item => Number(item.operadora_id) === Number(operadora.id));
        if (operadoraAtual) {
          operadoraAtual.quantidade_chips = Number(operadoraAtual.quantidade_chips || 0) + quantidadeLinha;
          operadoraAtual.valor_pago = Number((Number(operadoraAtual.valor_pago || 0) + valorLinha).toFixed(2));
        } else {
          atual.operadoras_atuais.push({
            operadora_id: operadora.id,
            quantidade_chips: quantidadeLinha,
            valor_pago: Number(valorLinha.toFixed(2)),
            fidelidade_fim: null
          });
        }
      } else {
        operadorasNaoEncontradas.add(operadoraTexto);
      }
    }

    porCnpj.set(cnpjDigitos, atual);
  }

  resultado.cnpjs_unicos = porCnpj.size;
  resultado.operadoras_nao_encontradas = Array.from(operadorasNaoEncontradas);
  return { clientes: Array.from(porCnpj.values()), resultado };
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

function montarPayloadImportacao(dados, clienteExistente = null) {
  const telefoneWhatsapp = separarTelefone(dados.whatsapp);
  const telefoneFixo = separarTelefone(dados.fixo);
  const nome = escolherTexto(dados.nome, dados.razao_social, dados.cnpj);
  const payload = {
    base_anterior_sistema: true
  };

  if (dados.quantidade_chips > 0) {
    payload.quantidade_chips = dados.quantidade_chips;
  }

  if (dados.valor_pago > 0) {
    payload.valor_pago = Number(dados.valor_pago.toFixed(2));
  }

  if (clienteExistente) {
    complementarCampo(payload, clienteExistente, 'nome', nome);
    complementarCampo(payload, clienteExistente, 'razao_social', dados.razao_social);
    complementarCampo(payload, clienteExistente, 'cnpj', dados.cnpj);
    complementarCampo(payload, clienteExistente, 'cnpj_digitos', dados.cnpj_digitos);
    complementarCampo(payload, clienteExistente, 'responsavel_nome', dados.responsavel_nome);
    complementarCampo(payload, clienteExistente, 'email', dados.email);
    complementarCampo(payload, clienteExistente, 'whatsapp_ddd', telefoneWhatsapp.ddd);
    complementarCampo(payload, clienteExistente, 'whatsapp_numero', telefoneWhatsapp.numero);
    complementarCampo(payload, clienteExistente, 'fixo_ddd', telefoneFixo.ddd);
    complementarCampo(payload, clienteExistente, 'fixo_numero', telefoneFixo.numero);
    complementarCampo(payload, clienteExistente, 'operadora_atual_id', dados.operadora_atual_id);
    return payload;
  }

  return {
    ...payload,
    nome,
    razao_social: dados.razao_social || null,
    cnpj: dados.cnpj,
    cnpj_digitos: dados.cnpj_digitos,
    responsavel_tipo: 'rl',
    responsavel_nome: dados.responsavel_nome || null,
    email: dados.email || null,
    whatsapp_ddd: telefoneWhatsapp.ddd,
    whatsapp_numero: telefoneWhatsapp.numero,
    fixo_ddd: telefoneFixo.ddd,
    fixo_numero: telefoneFixo.numero,
    operadora_atual_id: dados.operadora_atual_id || null
  };
}

async function importarBaseAnterior(req, usuarioId) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const mapeamento = parseMapeamento(campos.mapeamento);

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna de CNPJ.');
  }

  const worksheet = await lerWorkbook(arquivo.buffer);

  return Cliente.transaction(async trx => {
    const operadorasPorNome = await montarMapaOperadoras(trx);
    const { clientes, resultado } = consolidarLinhasImportacao(worksheet, mapeamento, operadorasPorNome);
    const existentes = await Cliente.query(trx).whereNotNull('cnpj');
    const existentesPorCnpj = new Map(existentes.map(cliente => [sanitizarCnpj(cliente.cnpj), cliente]));

    resultado.criados = 0;
    resultado.atualizados = 0;

    for (const dados of clientes) {
      const existente = existentesPorCnpj.get(dados.cnpj_digitos);
      if (existente) {
        await Cliente.query(trx).patchAndFetchById(existente.id, {
          ...montarPayloadImportacao(dados, existente),
          updated_at: new Date()
        });
        if (dados.operadoras_atuais?.length > 0) {
          await sincronizarOperadorasCliente(existente.id, dados.operadoras_atuais, trx);
        }
        resultado.atualizados += 1;
        continue;
      }

      const criado = await Cliente.query(trx).insertAndFetch({
        ...montarPayloadImportacao(dados),
        criado_por_id: usuarioId
      });
      await sincronizarOperadorasCliente(criado.id, dados.operadoras_atuais, trx);
      existentesPorCnpj.set(dados.cnpj_digitos, criado);
      resultado.criados += 1;
    }

    return {
      arquivo: arquivo.filename,
      aba: worksheet.name,
      ...resultado
    };
  });
}

function montarPayload(dados) {
  const dadosNormalizados = { ...dados };

  if (dados.whatsapp !== undefined) {
    const whatsapp = separarTelefone(dados.whatsapp);
    dadosNormalizados.whatsapp_ddd = whatsapp.ddd;
    dadosNormalizados.whatsapp_numero = whatsapp.numero;
  }

  if (dados.fixo !== undefined) {
    const fixo = separarTelefone(dados.fixo);
    dadosNormalizados.fixo_ddd = fixo.ddd;
    dadosNormalizados.fixo_numero = fixo.numero;
  }

  const payload = {};

  CAMPOS.forEach((campo) => {
    const valor = limparValor(dadosNormalizados[campo]);

    if (valor !== undefined) {
      payload[campo] = valor;
    }
  });

  if (payload.nome !== undefined && payload.nome !== null) {
    payload.nome = String(payload.nome).trim();
  }

  if (payload.cnpj !== undefined) {
    const cnpjNormalizado = normalizarCnpjObrigatorio(payload.cnpj);
    payload.cnpj = cnpjNormalizado.cnpj;
    payload.cnpj_digitos = cnpjNormalizado.cnpj_digitos;
  }

  if (!payload.responsavel_tipo) {
    payload.responsavel_tipo = 'rl';
  }

  if (!['adm', 'rl'].includes(payload.responsavel_tipo)) {
    throw new Error('Tipo do responsável inválido.');
  }

  if (payload.operadora_atual_id !== undefined && payload.operadora_atual_id !== null) {
    payload.operadora_atual_id = Number(payload.operadora_atual_id);
  }

  if (payload.quantidade_chips !== undefined && payload.quantidade_chips !== null) {
    payload.quantidade_chips = Number(payload.quantidade_chips);
  }

  if (payload.valor_pago !== undefined) {
    payload.valor_pago = normalizarValorMonetario(payload.valor_pago);
  }

  if (payload.base_anterior_sistema !== undefined) {
    payload.base_anterior_sistema = Boolean(payload.base_anterior_sistema);
  }

  if (payload.fidelidade_fim !== undefined) {
    payload.fidelidade_fim = normalizarData(payload.fidelidade_fim);
  }

  return payload;
}

async function buscarClienteDuplicadoPorCnpj(cnpjDigitos, ignorarId = null, trx = null) {
  if (!cnpjDigitos) return null;

  const query = Cliente.query(trx)
    .select('id', 'nome', 'razao_social', 'cnpj', 'excluido_em')
    .where('cnpj_digitos', cnpjDigitos);

  if (ignorarId) {
    query.whereNot('id', Number(ignorarId));
  }

  return query.first();
}

function lancarErroCnpjDuplicado(cliente) {
  const nome = cliente.razao_social || cliente.nome || `#${cliente.id}`;
  const sufixo = cliente.excluido_em
    ? ' O cliente está na lixeira; restaure-o para usar este CNPJ.'
    : '';

  throw criarHttpError(409, `Ja existe um cliente cadastrado com este CNPJ (${nome}).${sufixo}`);
}

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);

      if (Array.isArray(parsed)) return parsed;

      return Object.entries(parsed)
        .filter(([, permitido]) => permitido === true)
        .map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

async function buscarEscopoClientes(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return { podeVerTodos: false, podeVerProprios: false };
  }

  if (usuario.role?.nome === 'admin') {
    return { podeVerTodos: true, podeVerProprios: true };
  }

  const permissoes = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return {
    podeVerTodos: permissoes.includes('clientes_ver_todos'),
    podeVerProprios: permissoes.includes('clientes_ver_proprios')
  };
}

async function usuarioTemPermissao(usuarioId, permissao) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return false;
  }

  if (usuario.role?.nome === 'admin') {
    return true;
  }

  const permissoes = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return permissoes.includes(permissao);
}

function aplicarEscopoClientes(query, usuarioId, escopo) {
  if (escopo.podeVerTodos) {
    return query;
  }

  if (!escopo.podeVerProprios) {
    query.whereRaw('1 = 0');
    return query;
  }

  query.where('criado_por_id', usuarioId);
  return query;
}

function montarAvisoFidelidade(cliente) {
  if (!cliente.fidelidade_fim || cliente.fidelidade_fim === '1899-11-30') {
    return null;
  }

  const hoje = new Date();
  const fim = new Date(cliente.fidelidade_fim);
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);

  if (diasRestantes > 30) {
    return {
      dias_restantes: diasRestantes,
      deve_avisar: false,
      nivel: null
    };
  }

  return {
    dias_restantes: diasRestantes,
    deve_avisar: true,
    nivel: diasRestantes < 0 ? 'vencida' : diasRestantes === 0 ? 'hoje' : diasRestantes <= 10 ? 'urgente' : 'proximo'
  };
}

function formatarCliente(cliente) {
  if (!cliente) return cliente;

  const json = typeof cliente.toJSON === 'function' ? cliente.toJSON() : cliente;
  const operadorasAtuais = formatarOperadorasCliente(json.operadorasAtuais || json.operadoras_atuais || []);
  const resumo = obterResumoOperadorasCliente(operadorasAtuais);

  return {
    ...json,
    operadorasAtuais: operadorasAtuais,
    operadoras_atuais: operadorasAtuais,
    operadora_atual_id: resumo.operadora_atual_id ?? json.operadora_atual_id ?? null,
    operadoraAtual: resumo.operadoraAtual || json.operadoraAtual || null,
    quantidade_chips: resumo.quantidade_chips ?? json.quantidade_chips ?? null,
    valor_pago: resumo.valor_pago ?? json.valor_pago ?? null,
    fidelidade_fim: resumo.fidelidade_fim ?? json.fidelidade_fim ?? null,
    aviso_fidelidade: montarAvisoFidelidade({ fidelidade_fim: resumo.fidelidade_fim ?? json.fidelidade_fim })
  };
}

async function montarResumoNotasClientes(clientes, usuarioId) {
  const ids = clientes.map(cliente => Number(cliente.id)).filter(Boolean);

  if (ids.length === 0) {
    return new Map();
  }

  const linhas = await Cliente.knex()('entidade_notas')
    .where('entidade_tipo', 'cliente')
    .where('usuario_id', Number(usuarioId))
    .whereIn('entidade_id', ids)
    .groupBy('entidade_id')
    .select('entidade_id')
    .count('id as notas_total')
    .select(Cliente.knex().raw('SUM(CASE WHEN retorno_agendado_para IS NULL THEN 0 ELSE 1 END) as notas_com_retorno_total'))
    .select(Cliente.knex().raw('SUM(CASE WHEN retorno_agendado_para <= NOW() THEN 1 ELSE 0 END) as notas_retorno_vencido_total'))
    .min('retorno_agendado_para as proximo_retorno_agendado_para')
    .select(Cliente.knex().raw('MIN(CASE WHEN retorno_agendado_para <= NOW() THEN retorno_agendado_para ELSE NULL END) as proximo_retorno_vencido_para'));

  return new Map(linhas.map(linha => ([
    Number(linha.entidade_id),
    {
      notas_total: Number(linha.notas_total || 0),
      notas_com_retorno_total: Number(linha.notas_com_retorno_total || 0),
      notas_retorno_vencido_total: Number(linha.notas_retorno_vencido_total || 0),
      proximo_retorno_agendado_para: linha.proximo_retorno_agendado_para || null,
      proximo_retorno_vencido_para: linha.proximo_retorno_vencido_para || null
    }
  ])));
}

async function montarResumoVendasClientes(clientes) {
  const ids = clientes.map(cliente => Number(cliente.id)).filter(Boolean);

  if (ids.length === 0) {
    return new Map();
  }

  const linhas = await Cliente.knex()('vendas')
    .whereIn('cliente_id', ids)
    .groupBy('cliente_id')
    .select('cliente_id')
    .count('id as vendas_total');

  return new Map(linhas.map(linha => [
    Number(linha.cliente_id),
    Number(linha.vendas_total || 0)
  ]));
}

async function adicionarResumoNotasClientes(clientes, usuarioId) {
  const resumoPorCliente = await montarResumoNotasClientes(clientes, usuarioId);

  return clientes.map(cliente => ({
    ...cliente,
    notas_resumo: resumoPorCliente.get(Number(cliente.id)) || {
      notas_total: 0,
      notas_com_retorno_total: 0,
      notas_retorno_vencido_total: 0,
      proximo_retorno_agendado_para: null,
      proximo_retorno_vencido_para: null
    }
  }));
}

async function adicionarResumoVendasRelacionadas(clientes) {
  const resumoPorCliente = await montarResumoVendasClientes(clientes);

  return clientes.map(cliente => ({
    ...cliente,
    vendas_relacionadas_total: resumoPorCliente.get(Number(cliente.id)) || 0
  }));
}

function aplicarBuscaClientes(query, termo) {
  const busca = `%${termo}%`;
  const cnpjDigitos = sanitizarCnpj(termo);

  query.where((builder) => {
    builder
      .where('nome', 'like', busca)
      .orWhere('razao_social', 'like', busca)
      .orWhere('cnpj', 'like', busca)
      .orWhere('email', 'like', busca)
      .orWhere('responsavel_nome', 'like', busca);

    if (cnpjDigitos) {
      builder.orWhere('cnpj_digitos', 'like', `%${cnpjDigitos}%`);
    }
  });
}

function subquerySomaChipsCliente() {
  return Cliente.knex().raw(`(
    SELECT COALESCE(SUM(co.quantidade_chips), 0)
    FROM cliente_operadoras co
    WHERE co.cliente_id = clientes.id
  )`);
}

function aplicarFiltroFidelidadeOperadoras(query, tipo) {
  const knex = Cliente.knex();

  if (tipo === 'sem') {
    query.whereNotExists(
      knex.select(knex.raw('1'))
        .from('cliente_operadoras as co')
        .whereRaw('co.cliente_id = clientes.id')
        .whereNotNull('co.fidelidade_fim')
        .whereNot('co.fidelidade_fim', '1899-11-30')
    );
    return;
  }

  query.whereExists(function () {
    this.select(knex.raw('1'))
      .from('cliente_operadoras as co')
      .whereRaw('co.cliente_id = clientes.id')
      .whereNotNull('co.fidelidade_fim')
      .whereNot('co.fidelidade_fim', '1899-11-30');

    if (tipo === 'alerta') {
      this.whereRaw('co.fidelidade_fim <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    } else if (tipo === 'vencida') {
      this.whereRaw('co.fidelidade_fim < CURDATE()');
    } else if (tipo === 'ativa') {
      this.whereRaw('co.fidelidade_fim >= CURDATE()');
    }
  });
}

async function listarClientes(filtros = {}, usuarioId) {
  const escopo = await buscarEscopoClientes(usuarioId);
  const paginar = filtros.page !== undefined || filtros.per_page !== undefined;
  const { page, perPage } = normalizarPaginacao(filtros);

  const query = Cliente.query()
    .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador]')
    .whereNull('excluido_em');

  aplicarEscopoClientes(query, usuarioId, escopo);

  if (filtros.cliente_id) {
    query.where('id', Number(filtros.cliente_id));
  }

  if (filtros.busca) {
    aplicarBuscaClientes(query, filtros.busca);
  }

  if (filtros.operadora_atual_id) {
    query.whereExists(
      Cliente.knex().select(Cliente.knex().raw('1'))
        .from('cliente_operadoras as co')
        .whereRaw('co.cliente_id = clientes.id')
        .where('co.operadora_id', Number(filtros.operadora_atual_id))
    );
  }

  if (['adm', 'rl'].includes(filtros.responsavel_tipo)) {
    query.where('responsavel_tipo', filtros.responsavel_tipo);
  }

  if (filtros.chips_min) {
    query.where(subquerySomaChipsCliente(), '>=', Number(filtros.chips_min));
  }

  if (filtros.chips_max) {
    query.where(subquerySomaChipsCliente(), '<=', Number(filtros.chips_max));
  }

  if (filtros.base_anterior_sistema === 'true' || filtros.base_anterior_sistema === '1') {
    query.where('base_anterior_sistema', true);
  }

  if (filtros.base_anterior_sistema === 'false' || filtros.base_anterior_sistema === '0') {
    query.where('base_anterior_sistema', false);
  }

  if (filtros.avisos_fidelidade || filtros.fidelidade === 'alerta') {
    aplicarFiltroFidelidadeOperadoras(query, 'alerta');
  } else if (filtros.fidelidade === 'sem') {
    aplicarFiltroFidelidadeOperadoras(query, 'sem');
  } else if (filtros.fidelidade === 'vencida') {
    aplicarFiltroFidelidadeOperadoras(query, 'vencida');
  } else if (filtros.fidelidade === 'ativa') {
    aplicarFiltroFidelidadeOperadoras(query, 'ativa');
  }

  if (filtros.retorno === 'vencido' && usuarioId) {
    query.whereExists(
      Cliente.knex().select(Cliente.knex().raw('1')).from('entidade_notas')
        .where('entidade_tipo', 'cliente')
        .where('usuario_id', Number(usuarioId))
        .whereRaw('entidade_id = clientes.id')
        .whereRaw('retorno_agendado_para <= NOW()')
    );
  }

  if (filtros.fidelidade === 'alerta') {
    query.orderByRaw(`(
      SELECT MIN(co.fidelidade_fim)
      FROM cliente_operadoras co
      WHERE co.cliente_id = clientes.id
        AND co.fidelidade_fim IS NOT NULL
        AND co.fidelidade_fim <> '1899-11-30'
    ) asc`);
  } else {
    query.orderBy('nome', 'asc');
  }

  if (paginar) {
    const result = await query.page(page - 1, perPage);
    const clientes = await adicionarResumoNotasClientes(result.results.map(formatarCliente), usuarioId);
    return { data: clientes, total: result.total };
  }

  return adicionarResumoNotasClientes((await query).map(formatarCliente), usuarioId);
}

async function listarClientesSelect(filtros = {}, usuarioId) {
  const escopo = await buscarEscopoClientes(usuarioId);
  const limite = Math.min(Math.max(Number.parseInt(filtros.limite, 10) || 300, 1), 500);
  const query = Cliente.query()
    .select(
      'id',
      'nome',
      'razao_social',
      'cnpj',
      'responsavel_tipo',
      'responsavel_nome',
      'email',
      'whatsapp_ddd',
      'whatsapp_numero',
      'fixo_ddd',
      'fixo_numero',
      'fidelidade_fim',
      'operadora_atual_id',
      'valor_pago',
      'quantidade_chips',
      'base_anterior_sistema',
      'criado_por_id'
    )
    .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora]')
    .whereNull('excluido_em')
    .orderBy('nome', 'asc')
    .limit(limite);

  aplicarEscopoClientes(query, usuarioId, escopo);

  if (filtros.busca) {
    aplicarBuscaClientes(query, filtros.busca);
  }

  return (await query).map(formatarCliente);
}

async function buscarClientePorId(id, usuarioId) {
  const escopo = usuarioId ? await buscarEscopoClientes(usuarioId) : { podeVerTodos: true };
  const query = Cliente.query()
    .findById(id)
    .whereNull('excluido_em')
    .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador]');

  if (usuarioId) {
    aplicarEscopoClientes(query, usuarioId, escopo);
  }

  return formatarCliente(await query);
}

async function usuarioPodeAcessarCliente(id, usuarioId, opcoes = {}) {
  const escopo = await buscarEscopoClientes(usuarioId);

  if (escopo.podeVerTodos) {
    return true;
  }

  if (!escopo.podeVerProprios) {
    return false;
  }

  const query = Cliente.query()
    .findById(id)
    .select('id', 'criado_por_id');

  if (!opcoes.incluirLixeira) {
    query.whereNull('excluido_em');
  }

  const cliente = await query;

  return Number(cliente?.criado_por_id) === Number(usuarioId);
}

async function criarCliente(dados, usuarioId) {
  const payload = montarPayload(dados);
  const duplicado = await buscarClienteDuplicadoPorCnpj(payload.cnpj_digitos);

  if (duplicado) {
    lancarErroCnpjDuplicado(duplicado);
  }

  const cliente = await Cliente.transaction(async trx => {
    const criado = await Cliente.query(trx).insertAndFetch({
      ...payload,
      criado_por_id: usuarioId
    });

    await sincronizarOperadorasCliente(criado.id, dados.operadoras_atuais || dados.operadorasAtuais || normalizarOperadorasCliente(dados), trx);
    return formatarCliente(await Cliente.query(trx)
      .findById(criado.id)
      .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador]'));
  });

  await notificacaoService.sincronizarFidelidadeCliente(cliente.id);

  return cliente;
}

async function atualizarCliente(id, dados, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId);

  if (!permitido) {
    return null;
  }

  const payload = montarPayload(dados);
  const duplicado = await buscarClienteDuplicadoPorCnpj(payload.cnpj_digitos, id);

  if (duplicado) {
    lancarErroCnpjDuplicado(duplicado);
  }

  const cliente = await Cliente.transaction(async trx => {
    const atualizado = await Cliente.query(trx).patchAndFetchById(id, {
      ...payload,
      updated_at: new Date()
    });

    if (!atualizado) return null;

    if (dados.operadoras_atuais !== undefined || dados.operadorasAtuais !== undefined
      || dados.operadora_atual_id !== undefined || dados.quantidade_chips !== undefined
      || dados.valor_pago !== undefined || dados.fidelidade_fim !== undefined) {
      await sincronizarOperadorasCliente(id, dados.operadoras_atuais || dados.operadorasAtuais || normalizarOperadorasCliente(dados), trx);
    }

    return formatarCliente(await Cliente.query(trx)
      .findById(id)
      .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador]'));
  });

  if (cliente) {
    await notificacaoService.sincronizarFidelidadeCliente(cliente.id);
  }

  return cliente;
}

async function atribuirDonoCliente(id, donoId, usuarioId) {
  const podeAtribuir = await usuarioTemPermissao(usuarioId, 'clientes_atribuir_vendedora');

  if (!podeAtribuir) {
    throw criarHttpError(403, 'Voce nao tem permissao para atribuir clientes.');
  }

  if (!donoId) {
    throw criarHttpError(400, 'Selecione uma vendedora para atribuir o cliente.');
  }

  const cliente = await Cliente.query()
    .findById(id)
    .whereNull('excluido_em')
    .select('id');

  if (!cliente) {
    return null;
  }

  const dono = await Usuario.query()
    .findById(donoId)
    .select('id', 'nome', 'email', 'ativo');

  if (!dono || !dono.ativo) {
    throw criarHttpError(400, 'Selecione uma vendedora ativa para atribuir o cliente.');
  }

  await Cliente.query().patchAndFetchById(id, {
    criado_por_id: Number(donoId),
    updated_at: new Date()
  });

  const atualizado = formatarCliente(await Cliente.query()
    .findById(id)
    .whereNull('excluido_em')
    .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador]'));
  const [comNotas] = await adicionarResumoNotasClientes([atualizado], usuarioId);
  return comNotas;
}

async function excluirCliente(id, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId);

  if (!permitido) {
    return 0;
  }

  const agora = new Date();

  return Cliente.knex()('clientes')
    .where('id', id)
    .whereNull('excluido_em')
    .update({
      excluido_em: formatarDateTimeSQL(agora),
      excluir_definitivo_em: formatarDateTimeSQL(adicionarUmMes(agora)),
      excluido_por_id: usuarioId,
      updated_at: formatarDateTimeSQL(agora)
    });
}

async function contarVendasRelacionadasCliente(clienteId, trx = null) {
  const resultado = await Venda.query(trx)
    .where('cliente_id', clienteId)
    .count('id as total')
    .first();

  return Number(resultado?.total || 0);
}

async function limparClientesVencidosDaLixeira() {
  return Cliente.transaction(async trx => {
    const agora = formatarDateTimeSQL();
    const clientes = await Cliente.query(trx)
      .select('id', 'nome', 'razao_social', 'cnpj')
      .whereNotNull('excluido_em')
      .where('excluir_definitivo_em', '<=', agora);

    const clientesSemVendas = [];
    for (const cliente of clientes) {
      const totalVendas = await contarVendasRelacionadasCliente(cliente.id, trx);
      if (totalVendas === 0) {
        clientesSemVendas.push(cliente);
      }
    }

    if (clientesSemVendas.length === 0) {
      return 0;
    }

    return Cliente.query(trx)
      .delete()
      .whereIn('id', clientesSemVendas.map(cliente => cliente.id));
  });
}

async function listarClientesLixeira(filtros = {}, usuarioId) {
  await limparClientesVencidosDaLixeira();

  const escopo = await buscarEscopoClientes(usuarioId);
  const query = Cliente.query()
    .withGraphFetched('[operadoraAtual, operadorasAtuais.operadora, criador, excluidoPor]')
    .whereNotNull('excluido_em')
    .orderBy('excluido_em', 'desc')
    .orderBy('id', 'desc');

  aplicarEscopoClientes(query, usuarioId, escopo);

  if (filtros.busca) {
    aplicarBuscaClientes(query, filtros.busca);
  }

  return adicionarResumoVendasRelacionadas((await query).map(formatarCliente));
}

async function restaurarCliente(id, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return null;
  }

  const atualizados = await Cliente.knex()('clientes')
    .where('id', id)
    .whereNotNull('excluido_em')
    .update({
      excluido_em: null,
      excluir_definitivo_em: null,
      excluido_por_id: null,
      updated_at: formatarDateTimeSQL()
    });

  if (!atualizados) {
    return null;
  }

  return buscarClientePorId(id, usuarioId);
}

async function excluirClienteDefinitivo(id, usuarioId, opcoes = {}) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return 0;
  }

  const excluirVendasRelacionadas = Boolean(opcoes.excluirVendasRelacionadas);

  return Cliente.transaction(async trx => {
    const cliente = await Cliente.query(trx)
      .findById(id)
      .whereNotNull('excluido_em')
      .select('id', 'nome', 'razao_social', 'cnpj');

    if (!cliente) {
      return 0;
    }

    const totalVendasRelacionadas = await contarVendasRelacionadasCliente(id, trx);

    if (totalVendasRelacionadas > 0 && !excluirVendasRelacionadas) {
      const error = criarHttpError(
        409,
        `Este cliente possui ${totalVendasRelacionadas} venda(s) relacionada(s). Exclua as vendas antes ou confirme a exclusao delas junto com o cliente.`
      );
      error.totalVendasRelacionadas = totalVendasRelacionadas;
      throw error;
    }

    const vendasRelacionadas = Venda.query(trx).where('cliente_id', id);

    if (totalVendasRelacionadas > 0 && excluirVendasRelacionadas) {
      await vendasRelacionadas.delete();
    }

    return Cliente.query(trx)
      .delete()
      .where('id', id)
      .whereNotNull('excluido_em');
  });
}

async function limparClientesBaseAnterior(opcoes = {}) {
  return Cliente.transaction(async trx => {
    const clientes = await Cliente.query(trx)
      .select('id', 'nome', 'razao_social', 'cnpj')
      .where('base_anterior_sistema', true);
    if (clientes.length === 0) {
      return { excluidos: 0, vendas_excluidas: 0 };
    }

    const excluirVendasRelacionadas = Boolean(opcoes.excluirVendasRelacionadas);
    const clienteIdsTodos = clientes.map(cliente => Number(cliente.id)).filter(Boolean);
    let vendasExcluidas = 0;
    let clienteIds = clienteIdsTodos;

    if (excluirVendasRelacionadas && clienteIdsTodos.length > 0) {
      vendasExcluidas = await Venda.query(trx)
        .whereIn('cliente_id', clienteIdsTodos)
        .delete();
    } else {
      const clientesSemVendas = [];
      for (const cliente of clientes) {
        const totalVendas = await contarVendasRelacionadasCliente(cliente.id, trx);
        if (totalVendas === 0) {
          clientesSemVendas.push(cliente);
        }
      }

      if (clientesSemVendas.length === 0) {
        return { excluidos: 0, vendas_excluidas: 0, ignorados_com_vendas: clientes.length };
      }

      clienteIds = clientesSemVendas.map(cliente => Number(cliente.id)).filter(Boolean);
    }

    const notas = await trx('entidade_notas')
      .select('id')
      .where('entidade_tipo', 'cliente')
      .whereIn('entidade_id', clienteIds);
    const notaIds = notas.map(nota => Number(nota.id)).filter(Boolean);
    const sourceKeys = clienteIds.map(id => `cliente_fidelidade:${id}`);

    notaIds.forEach(id => {
      sourceKeys.push(`nota_retorno_pre:${id}`);
      sourceKeys.push(`nota_retorno_due:${id}`);
    });

    const notificacoesQuery = trx('notificacoes')
      .select('id')
      .where(builder => {
        builder
          .where(function () {
            this.where('entidade', 'clientes').whereIn('entidade_id', clienteIds);
          });

        if (sourceKeys.length > 0) {
          builder.orWhereIn('source_key', sourceKeys);
        }
      });
    const notificacoes = await notificacoesQuery;
    const notificacaoIds = notificacoes.map(notificacao => Number(notificacao.id)).filter(Boolean);

    if (notificacaoIds.length > 0) {
      await trx('notificacao_destinatarios')
        .whereIn('notificacao_id', notificacaoIds)
        .delete();
      await trx('notificacoes')
        .whereIn('id', notificacaoIds)
        .delete();
    }

    if (notaIds.length > 0) {
      await trx('entidade_notas')
        .whereIn('id', notaIds)
        .delete();
    }

    const excluidos = await Cliente.query(trx)
      .whereIn('id', clienteIds)
      .delete();

    return {
      excluidos,
      vendas_excluidas: vendasExcluidas,
      ignorados_com_vendas: excluirVendasRelacionadas ? 0 : clientes.length - clienteIds.length
    };
  });
}

module.exports = {
  listarClientes,
  listarClientesSelect,
  listarClientesLixeira,
  buscarClientePorId,
  criarCliente,
  atualizarCliente,
  atribuirDonoCliente,
  excluirCliente,
  restaurarCliente,
  excluirClienteDefinitivo,
  limparClientesBaseAnterior,
  usuarioPodeAcessarCliente,
  previewImportacaoBaseAnterior,
  importarBaseAnterior
};
