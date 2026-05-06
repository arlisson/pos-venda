const Busboy = require('busboy');
const archiver = require('archiver');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Arquivo = require('../models/Arquivo');
const Venda = require('../models/Venda');
const VendaArquivo = require('../models/VendaArquivo');
const VendaArquivoPacote = require('../models/VendaArquivoPacote');
const Usuario = require('../models/Usuario');

const STORAGE_DIR = path.resolve(
  process.env.VENDA_ARQUIVOS_STORAGE_DIR || path.resolve(__dirname, '../../storage/venda-arquivos')
);
const MAX_FILE_MB = Number(process.env.VENDA_ARQUIVOS_MAX_FILE_MB || 50);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES_PER_VENDA = Number(process.env.VENDA_ARQUIVOS_MAX_FILES_PER_VENDA || 30);
const RETENCAO_DIAS = Number(process.env.VENDA_ARQUIVOS_RETENCAO_INDIVIDUAIS_DIAS || 30);
const ALLOWED_TYPES = String(
  process.env.VENDA_ARQUIVOS_ALLOWED_TYPES || 'application/pdf,image/jpeg,image/png,image/webp'
).split(',').map(item => item.trim()).filter(Boolean);

const EXTENSOES_POR_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      return parsePermissoes(JSON.parse(permissoes));
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

async function buscarEscopoVendas(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return { podeVerTodas: false, podeVerProprias: false };
  }

  if (usuario.role?.nome === 'admin') {
    return { podeVerTodas: true, podeVerProprias: true };
  }

  const permissoes = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return {
    podeVerTodas: permissoes.includes('vendas_ver_todas'),
    podeVerProprias: permissoes.includes('vendas_ver_proprias')
  };
}

async function usuarioPodeAcessarVenda(vendaId, usuarioId) {
  const escopo = await buscarEscopoVendas(usuarioId);

  if (escopo.podeVerTodas) return true;
  if (!escopo.podeVerProprias) return false;

  const venda = await Venda.query()
    .findById(vendaId)
    .select('id', 'criado_por_id', 'vendedora_id')
    .whereNull('excluido_em');

  return Number(venda?.criado_por_id) === Number(usuarioId)
    || Number(venda?.vendedora_id) === Number(usuarioId);
}

async function garantirAcessoVenda(vendaId, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(vendaId, usuarioId);

  if (!permitido) {
    const error = new Error('Venda nao encontrada.');
    error.statusCode = 404;
    throw error;
  }
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = value => String(value).padStart(2, '0');

  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate())
  ].join('-') + ' ' + [
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds())
  ].join(':');
}

function adicionarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

async function garantirDiretorio(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function caminhoRelativoAtivo(hash, extensao) {
  return path.join('ativos', hash.slice(0, 2), hash.slice(2, 4), `${hash}${extensao || ''}`);
}

function caminhoAbsoluto(relativo) {
  return path.resolve(STORAGE_DIR, relativo);
}

function normalizarNomeArquivo(nome) {
  const base = path.basename(String(nome || 'arquivo'));
  return base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'arquivo';
}

function extensaoPorArquivo(nome, mimeType) {
  const ext = path.extname(String(nome || '')).toLowerCase().slice(0, 20);
  return ext || EXTENSOES_POR_MIME[mimeType] || '';
}

function formatarArquivoVenda(row) {
  return {
    id: row.id,
    venda_id: row.venda_id,
    arquivo_id: row.arquivo_id,
    nome_original: row.nome_original,
    categoria: row.categoria,
    descricao: row.descricao,
    ordem: row.ordem,
    remover_apos: row.remover_apos,
    excluido_em: row.excluido_em,
    created_at: row.created_at,
    arquivo: row.arquivo ? {
      id: row.arquivo.id,
      mime_type: row.arquivo.mime_type,
      extensao: row.arquivo.extensao,
      tamanho_bytes: Number(row.arquivo.tamanho_bytes || 0),
      hash_sha256: row.arquivo.hash_sha256,
      removido_em: row.arquivo.removido_em
    } : null,
    criado_por: row.criadoPor ? {
      id: row.criadoPor.id,
      nome: row.criadoPor.nome,
      email: row.criadoPor.email
    } : null
  };
}

function formatarPacote(pacote) {
  if (!pacote) return null;

  return {
    id: pacote.id,
    venda_id: pacote.venda_id,
    status: pacote.status,
    hash_sha256: pacote.hash_sha256,
    tamanho_bytes: pacote.tamanho_bytes ? Number(pacote.tamanho_bytes) : null,
    total_arquivos: pacote.total_arquivos,
    erro: pacote.erro,
    gerado_por_id: pacote.gerado_por_id,
    gerado_em: pacote.gerado_em,
    created_at: pacote.created_at,
    updated_at: pacote.updated_at
  };
}

async function listarArquivos(vendaId, usuarioId) {
  await garantirAcessoVenda(vendaId, usuarioId);

  const arquivos = await VendaArquivo.query()
    .where('venda_id', vendaId)
    .whereNull('excluido_em')
    .withGraphFetched('[arquivo, criadoPor]')
    .modifyGraph('criadoPor', builder => builder.select('id', 'nome', 'email'))
    .orderBy('ordem', 'asc')
    .orderBy('id', 'asc');

  const pacote = await obterPacote(vendaId, usuarioId, { validarAcesso: false });

  return {
    arquivos: arquivos.map(formatarArquivoVenda),
    pacote
  };
}

async function receberArquivoUpload(req, vendaId, usuarioId) {
  await garantirAcessoVenda(vendaId, usuarioId);

  const totalAtivos = await VendaArquivo.query()
    .where('venda_id', vendaId)
    .whereNull('excluido_em')
    .resultSize();

  if (totalAtivos >= MAX_FILES_PER_VENDA) {
    const error = new Error(`Limite de ${MAX_FILES_PER_VENDA} arquivos por venda atingido.`);
    error.statusCode = 400;
    throw error;
  }

  await garantirDiretorio(path.join(STORAGE_DIR, 'tmp'));

  const resultadoUpload = await new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_FILE_BYTES
      }
    });
    const campos = {};
    let uploadPromise = null;
    let arquivoRecebido = false;

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (field, file, info) => {
      arquivoRecebido = true;
      const nomeOriginal = normalizarNomeArquivo(info.filename || 'arquivo');
      const mimeType = info.mimeType || 'application/octet-stream';

      if (!ALLOWED_TYPES.includes(mimeType)) {
        file.resume();
        reject(new Error('Tipo de arquivo nao permitido.'));
        return;
      }

      const tempPath = path.join(STORAGE_DIR, 'tmp', `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.upload`);
      const output = fs.createWriteStream(tempPath);
      const hash = crypto.createHash('sha256');
      let tamanhoBytes = 0;
      let limiteAtingido = false;

      file.on('data', chunk => {
        tamanhoBytes += chunk.length;
        hash.update(chunk);
      });

      file.on('limit', () => {
        limiteAtingido = true;
        output.destroy(new Error(`Arquivo maior que ${MAX_FILE_MB} MB.`));
      });

      uploadPromise = new Promise((resolveUpload, rejectUpload) => {
        output.on('finish', () => {
          if (limiteAtingido) {
            fs.promises.unlink(tempPath).catch(() => {});
            rejectUpload(new Error(`Arquivo maior que ${MAX_FILE_MB} MB.`));
            return;
          }

          resolveUpload({
            tempPath,
            nomeOriginal,
            mimeType,
            extensao: extensaoPorArquivo(nomeOriginal, mimeType),
            tamanhoBytes,
            hashSha256: hash.digest('hex'),
            campos
          });
        });

        output.on('error', error => {
          fs.promises.unlink(tempPath).catch(() => {});
          rejectUpload(error);
        });
      });

      file.pipe(output);
    });

    busboy.on('finish', async () => {
      try {
        if (!arquivoRecebido || !uploadPromise) {
          throw new Error('Arquivo nao enviado.');
        }

        resolve(await uploadPromise);
      } catch (error) {
        reject(error);
      }
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });

  const arquivoVenda = await salvarArquivoVenda(vendaId, usuarioId, resultadoUpload);
  await marcarPacoteDesatualizado(vendaId);

  return arquivoVenda;
}

async function salvarArquivoVenda(vendaId, usuarioId, upload) {
  const existente = await Arquivo.query()
    .where('hash_sha256', upload.hashSha256)
    .first();

  let arquivo = existente;
  const relPath = caminhoRelativoAtivo(upload.hashSha256, upload.extensao);
  const absPath = caminhoAbsoluto(relPath);
  const arquivoExistenteDisponivel = arquivo
    && !arquivo.removido_em
    && fs.existsSync(caminhoAbsoluto(arquivo.storage_path));

  if (!arquivoExistenteDisponivel) {
    await garantirDiretorio(path.dirname(absPath));
    await fs.promises.rename(upload.tempPath, absPath);

    arquivo = arquivo
      ? await Arquivo.query().patchAndFetchById(arquivo.id, {
        mime_type: upload.mimeType,
        extensao: upload.extensao,
        tamanho_bytes: upload.tamanhoBytes,
        storage_driver: 'local',
        storage_path: relPath,
        removido_em: null,
        updated_at: formatarDateTimeSQL()
      })
      : await Arquivo.query().insertAndFetch({
        hash_sha256: upload.hashSha256,
        mime_type: upload.mimeType,
        extensao: upload.extensao,
        tamanho_bytes: upload.tamanhoBytes,
        storage_driver: 'local',
        storage_path: relPath,
        criado_por_id: usuarioId
      });
  } else {
    await fs.promises.unlink(upload.tempPath).catch(() => {});
  }

  const maiorOrdem = await VendaArquivo.query()
    .where('venda_id', vendaId)
    .max('ordem as ordem')
    .first();

  const vinculo = await VendaArquivo.query().insertAndFetch({
    venda_id: Number(vendaId),
    arquivo_id: arquivo.id,
    nome_original: upload.nomeOriginal,
    categoria: ['contrato', 'documento', 'comprovante', 'outro'].includes(upload.campos.categoria)
      ? upload.campos.categoria
      : 'outro',
    descricao: upload.campos.descricao ? String(upload.campos.descricao).slice(0, 500) : null,
    ordem: Number(maiorOrdem?.ordem || 0) + 1,
    criado_por_id: usuarioId
  });

  const completo = await VendaArquivo.query()
    .findById(vinculo.id)
    .withGraphFetched('[arquivo, criadoPor]')
    .modifyGraph('criadoPor', builder => builder.select('id', 'nome', 'email'));

  return formatarArquivoVenda(completo);
}

async function buscarVinculoArquivo(vendaId, arquivoVendaId, usuarioId) {
  await garantirAcessoVenda(vendaId, usuarioId);

  const vinculo = await VendaArquivo.query()
    .findById(arquivoVendaId)
    .where('venda_id', vendaId)
    .whereNull('excluido_em')
    .withGraphFetched('arquivo');

  if (!vinculo?.arquivo) {
    const error = new Error('Arquivo nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return vinculo;
}

async function prepararDownloadArquivo(vendaId, arquivoVendaId, usuarioId) {
  const vinculo = await buscarVinculoArquivo(vendaId, arquivoVendaId, usuarioId);
  const absPath = caminhoAbsoluto(vinculo.arquivo.storage_path);

  if (vinculo.arquivo.removido_em) {
    const error = new Error('Arquivo individual ja foi arquivado no pacote.');
    error.statusCode = 410;
    throw error;
  }

  await fs.promises.access(absPath, fs.constants.R_OK);

  return {
    stream: fs.createReadStream(absPath),
    nome: vinculo.nome_original,
    mimeType: vinculo.arquivo.mime_type,
    tamanhoBytes: Number(vinculo.arquivo.tamanho_bytes || 0)
  };
}

async function excluirArquivoVenda(vendaId, arquivoVendaId, usuarioId) {
  await buscarVinculoArquivo(vendaId, arquivoVendaId, usuarioId);

  const total = await VendaArquivo.query()
    .patch({
      excluido_em: formatarDateTimeSQL(),
      updated_at: formatarDateTimeSQL()
    })
    .where('id', arquivoVendaId)
    .where('venda_id', vendaId)
    .whereNull('excluido_em');

  if (total > 0) {
    await marcarPacoteDesatualizado(vendaId);
  }

  return total;
}

async function obterPacote(vendaId, usuarioId, opcoes = {}) {
  if (opcoes.validarAcesso !== false) {
    await garantirAcessoVenda(vendaId, usuarioId);
  }

  const pacote = await VendaArquivoPacote.query()
    .where('venda_id', vendaId)
    .orderBy('id', 'desc')
    .first();

  return formatarPacote(pacote);
}

async function solicitarPacoteVenda(vendaId, usuarioId, opcoes = {}) {
  if (opcoes.validarAcesso !== false) {
    await garantirAcessoVenda(vendaId, usuarioId);
  }

  const existente = await VendaArquivoPacote.query()
    .where('venda_id', vendaId)
    .whereIn('status', ['pendente', 'gerando', 'pronto'])
    .orderBy('id', 'desc')
    .first();

  if (existente?.status === 'pronto' && !opcoes.forcar) {
    return formatarPacote(existente);
  }

  const pacote = existente && existente.status !== 'gerando'
    ? await VendaArquivoPacote.query().patchAndFetchById(existente.id, {
      status: 'pendente',
      erro: null,
      updated_at: formatarDateTimeSQL()
    })
    : await VendaArquivoPacote.query().insertAndFetch({
      venda_id: Number(vendaId),
      status: 'pendente',
      storage_driver: 'local',
      gerado_por_id: usuarioId
    });

  setImmediate(() => {
    gerarPacoteVenda(vendaId, usuarioId, pacote.id).catch(error => {
      console.error('Erro ao gerar pacote de arquivos da venda:', error);
    });
  });

  return formatarPacote(pacote);
}

async function gerarPacoteVenda(vendaId, usuarioId, pacoteId = null) {
  const pacote = pacoteId
    ? await VendaArquivoPacote.query().findById(pacoteId)
    : await VendaArquivoPacote.query().where('venda_id', vendaId).orderBy('id', 'desc').first();

  if (!pacote) {
    return null;
  }

  await VendaArquivoPacote.query().patchAndFetchById(pacote.id, {
    status: 'gerando',
    erro: null,
    updated_at: formatarDateTimeSQL()
  });

  try {
    const arquivos = await VendaArquivo.query()
      .where('venda_id', vendaId)
      .whereNull('excluido_em')
      .withGraphFetched('arquivo')
      .orderBy('ordem', 'asc')
      .orderBy('id', 'asc');

    if (arquivos.length === 0) {
      throw new Error('Venda sem arquivos ativos para compactar.');
    }

    const relPath = path.join('pacotes', 'vendas', String(vendaId), `venda-${vendaId}-documentos.zip`);
    const absPath = caminhoAbsoluto(relPath);
    await garantirDiretorio(path.dirname(absPath));

    await criarZipVenda(absPath, arquivos);

    const { hashSha256, tamanhoBytes } = await hashArquivo(absPath);
    const pronto = await VendaArquivoPacote.query().patchAndFetchById(pacote.id, {
      status: 'pronto',
      hash_sha256: hashSha256,
      tamanho_bytes: tamanhoBytes,
      storage_driver: 'local',
      storage_path: relPath,
      total_arquivos: arquivos.length,
      erro: null,
      gerado_por_id: usuarioId,
      gerado_em: formatarDateTimeSQL(),
      updated_at: formatarDateTimeSQL()
    });

    await VendaArquivo.query()
      .patch({
        arquivado_no_pacote_id: pronto.id,
        remover_apos: formatarDateTimeSQL(adicionarDias(new Date(), RETENCAO_DIAS)),
        updated_at: formatarDateTimeSQL()
      })
      .where('venda_id', vendaId)
      .whereNull('excluido_em');

    return formatarPacote(pronto);
  } catch (error) {
    const atualizado = await VendaArquivoPacote.query().patchAndFetchById(pacote.id, {
      status: 'erro',
      erro: error.message || 'Erro ao gerar pacote.',
      updated_at: formatarDateTimeSQL()
    });

    return formatarPacote(atualizado);
  }
}

function nomeUnicoZip(nome, usados) {
  const limpo = normalizarNomeArquivo(nome);
  const ext = path.extname(limpo);
  const base = ext ? limpo.slice(0, -ext.length) : limpo;
  let candidato = limpo;
  let indice = 2;

  while (usados.has(candidato.toLowerCase())) {
    candidato = `${base} (${indice})${ext}`;
    indice += 1;
  }

  usados.add(candidato.toLowerCase());
  return candidato;
}

async function criarZipVenda(destino, arquivos) {
  await fs.promises.unlink(destino).catch(() => {});

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destino);
    const zip = archiver('zip', { zlib: { level: 9 } });
    const usados = new Set();

    output.on('close', resolve);
    output.on('error', reject);
    zip.on('error', reject);

    zip.pipe(output);

    arquivos.forEach(vinculo => {
      const arquivoPath = caminhoAbsoluto(vinculo.arquivo.storage_path);
      zip.file(arquivoPath, {
        name: nomeUnicoZip(vinculo.nome_original, usados)
      });
    });

    zip.finalize();
  });
}

async function hashArquivo(absPath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    let tamanhoBytes = 0;
    const stream = fs.createReadStream(absPath);

    stream.on('data', chunk => {
      tamanhoBytes += chunk.length;
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve({
      hashSha256: hash.digest('hex'),
      tamanhoBytes
    }));
  });
}

async function prepararDownloadPacote(vendaId, usuarioId) {
  await garantirAcessoVenda(vendaId, usuarioId);

  const pacote = await VendaArquivoPacote.query()
    .where('venda_id', vendaId)
    .where('status', 'pronto')
    .orderBy('id', 'desc')
    .first();

  if (!pacote?.storage_path) {
    const error = new Error('Pacote ainda nao esta pronto.');
    error.statusCode = 404;
    throw error;
  }

  const absPath = caminhoAbsoluto(pacote.storage_path);
  await fs.promises.access(absPath, fs.constants.R_OK);

  return {
    stream: fs.createReadStream(absPath),
    nome: `venda-${vendaId}-documentos.zip`,
    mimeType: 'application/zip',
    tamanhoBytes: Number(pacote.tamanho_bytes || 0)
  };
}

async function marcarPacoteDesatualizado(vendaId) {
  await VendaArquivoPacote.query()
    .patch({
      status: 'desatualizado',
      updated_at: formatarDateTimeSQL()
    })
    .where('venda_id', vendaId)
    .where('status', 'pronto');
}

async function limparArquivosIndividuaisVencidos() {
  const vencidos = await VendaArquivo.query()
    .whereNotNull('remover_apos')
    .where('remover_apos', '<=', formatarDateTimeSQL())
    .withGraphFetched('arquivo')
    .limit(100);

  let removidos = 0;

  for (const vinculo of vencidos) {
    const usosAtivos = await VendaArquivo.query()
      .where('arquivo_id', vinculo.arquivo_id)
      .whereNull('excluido_em')
      .where(builder => builder.whereNull('remover_apos').orWhere('remover_apos', '>', formatarDateTimeSQL()))
      .resultSize();

    if (usosAtivos > 0) continue;

    await fs.promises.unlink(caminhoAbsoluto(vinculo.arquivo.storage_path)).catch(() => {});
    await Arquivo.query().patchAndFetchById(vinculo.arquivo_id, {
      removido_em: formatarDateTimeSQL(),
      updated_at: formatarDateTimeSQL()
    });
    removidos += 1;
  }

  return removidos;
}

module.exports = {
  listarArquivos,
  receberArquivoUpload,
  prepararDownloadArquivo,
  excluirArquivoVenda,
  obterPacote,
  solicitarPacoteVenda,
  gerarPacoteVenda,
  prepararDownloadPacote,
  marcarPacoteDesatualizado,
  limparArquivosIndividuaisVencidos
};
