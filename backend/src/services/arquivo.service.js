/**
 * Servico de persistencia e leitura de arquivos no armazenamento local.
 */
const Busboy = require('busboy');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Arquivo = require('../models/Arquivo');

const STORAGE_DIR = path.resolve(
  process.env.ARQUIVOS_STORAGE_DIR
  || process.env.VENDA_ARQUIVOS_STORAGE_DIR
  || path.resolve(__dirname, '../../storage/venda-arquivos')
);

const EXTENSOES_POR_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

/**
 * Formata date time sql para exibicao ou envio.
 */
function formatarDateTimeSQL(data = new Date()) {
  /**
   * Preenche valores numericos com zero a esquerda.
   */
  const pad = valor => String(valor).padStart(2, '0');

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

/**
 * Garante diretorio antes de continuar o fluxo.
 */
async function garantirDiretorio(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Processa caminho relativo ativo conforme as regras do dominio.
 */
function caminhoRelativoAtivo(hash, extensao) {
  return path.join('ativos', hash.slice(0, 2), hash.slice(2, 4), `${hash}${extensao || ''}`);
}

/**
 * Processa caminho absoluto conforme as regras do dominio.
 */
function caminhoAbsoluto(relativo) {
  return path.resolve(STORAGE_DIR, relativo);
}

/**
 * Normaliza nome arquivo para uso interno consistente.
 */
function normalizarNomeArquivo(nome) {
  const base = path.basename(String(nome || 'arquivo'));
  return base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'arquivo';
}

/**
 * Processa extensao por arquivo conforme as regras do dominio.
 */
function extensaoPorArquivo(nome, mimeType) {
  const ext = path.extname(String(nome || '')).toLowerCase().slice(0, 20);
  return ext || EXTENSOES_POR_MIME[mimeType] || '';
}

// Lê 1 arquivo do multipart e grava num temp + calcula hash em streaming.
// Retorna { tempPath, nomeOriginal, mimeType, extensao, tamanhoBytes, hashSha256, campos }.
/**
 * Processa receber upload conforme as regras do dominio.
 */
async function receberUpload(req, { allowedTypes, maxFileBytes }) {
  await garantirDiretorio(path.join(STORAGE_DIR, 'tmp'));

  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: maxFileBytes }
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

      if (allowedTypes && !allowedTypes.includes(mimeType)) {
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
        output.destroy(new Error('Arquivo excede o tamanho permitido.'));
      });

      uploadPromise = new Promise((resolveUpload, rejectUpload) => {
        output.on('finish', () => {
          if (limiteAtingido) {
            fs.promises.unlink(tempPath).catch(() => {});
            rejectUpload(new Error('Arquivo excede o tamanho permitido.'));
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
}

// Dedup por hash: se já existir um Arquivo válido com o mesmo hash, reusa.
// Caso contrário, move o tmp para ativos/aa/bb/<hash>.<ext> e cria/atualiza a linha.
/**
 * Processa materializar arquivo conforme as regras do dominio.
 */
async function materializarArquivo(upload, usuarioId) {
  const existente = await Arquivo.query()
    .where('hash_sha256', upload.hashSha256)
    .first();

  const relPath = caminhoRelativoAtivo(upload.hashSha256, upload.extensao);
  const absPath = caminhoAbsoluto(relPath);

  const existenteDisponivel = existente
    && !existente.removido_em
    && fs.existsSync(caminhoAbsoluto(existente.storage_path));

  if (existenteDisponivel) {
    await fs.promises.unlink(upload.tempPath).catch(() => {});
    return existente;
  }

  await garantirDiretorio(path.dirname(absPath));
  await fs.promises.rename(upload.tempPath, absPath);

  if (existente) {
    return Arquivo.query().patchAndFetchById(existente.id, {
      mime_type: upload.mimeType,
      extensao: upload.extensao,
      tamanho_bytes: upload.tamanhoBytes,
      storage_driver: 'local',
      storage_path: relPath,
      removido_em: null,
      updated_at: formatarDateTimeSQL()
    });
  }

  return Arquivo.query().insertAndFetch({
    hash_sha256: upload.hashSha256,
    mime_type: upload.mimeType,
    extensao: upload.extensao,
    tamanho_bytes: upload.tamanhoBytes,
    storage_driver: 'local',
    storage_path: relPath,
    criado_por_id: usuarioId
  });
}

// Remove do disco e da tabela `arquivos` qualquer blob que: (a) já passou
// `idadeMinimaHoras` desde o upload, (b) não tem nenhum vínculo ativo em
// `venda_arquivos` ou `mensagem_arquivos`. Roda em batch limitado pra não
// segurar o event loop em bases grandes.
/**
 * Limpa arquivos orfaos e restaura o estado inicial.
 */
async function limparArquivosOrfaos({ idadeMinimaHoras = 24, limite = 500 } = {}) {
  const Arquivo = require('../models/Arquivo');
  const knex = Arquivo.knex();

  const corteSql = formatarDateTimeSQL(new Date(Date.now() - idadeMinimaHoras * 60 * 60 * 1000));

  // Candidatos: arquivos antigos e ainda "vivos" (sem removido_em) sem vínculo.
  const candidatos = await knex('arquivos')
    .leftJoin('venda_arquivos', function () {
      this.on('venda_arquivos.arquivo_id', '=', 'arquivos.id')
        .andOnNull('venda_arquivos.excluido_em');
    })
    .leftJoin('mensagem_arquivos', 'mensagem_arquivos.arquivo_id', '=', 'arquivos.id')
    .whereNull('arquivos.removido_em')
    .where('arquivos.created_at', '<=', corteSql)
    .whereNull('venda_arquivos.id')
    .whereNull('mensagem_arquivos.id')
    .select('arquivos.id', 'arquivos.storage_path')
    .limit(limite);

  let removidos = 0;

  for (const arquivo of candidatos) {
    try {
      await fs.promises.unlink(caminhoAbsoluto(arquivo.storage_path)).catch(() => {});
      await Arquivo.query().patchAndFetchById(arquivo.id, {
        removido_em: formatarDateTimeSQL(),
        updated_at: formatarDateTimeSQL()
      });
      removidos += 1;
    } catch (error) {
      console.error('Erro ao limpar arquivo orfao', arquivo.id, error);
    }
  }

  return removidos;
}

/**
 * Abre stream arquivo e prepara o estado necessario.
 */
async function abrirStreamArquivo(arquivo) {
  if (!arquivo) {
    const error = new Error('Arquivo nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (arquivo.removido_em) {
    const error = new Error('Arquivo nao esta mais disponivel.');
    error.statusCode = 410;
    throw error;
  }

  const absPath = caminhoAbsoluto(arquivo.storage_path);
  await fs.promises.access(absPath, fs.constants.R_OK);

  return {
    stream: fs.createReadStream(absPath),
    mimeType: arquivo.mime_type,
    tamanhoBytes: Number(arquivo.tamanho_bytes || 0)
  };
}

module.exports = {
  STORAGE_DIR,
  EXTENSOES_POR_MIME,
  formatarDateTimeSQL,
  garantirDiretorio,
  caminhoRelativoAtivo,
  caminhoAbsoluto,
  normalizarNomeArquivo,
  extensaoPorArquivo,
  receberUpload,
  materializarArquivo,
  abrirStreamArquivo,
  limparArquivosOrfaos
};
