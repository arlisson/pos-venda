const vendaArquivoService = require('../services/venda-arquivo.service');

/**
 * Gera nome seguro para cabecalho de download.
 *
 * @param {string} nome - Nome original do arquivo.
 * @returns {string} Nome codificado para Content-Disposition.
 */
function nomeDownload(nome) {
  return String(nome || 'arquivo')
    .replace(/[\r\n"]/g, '')
    .trim() || 'arquivo';
}

/**
 * Lista arquivos anexados a uma venda.
 *
 * @param {import('express').Request} req - Requisicao com vendaId em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Lista de arquivos.
 */
async function index(req, res) {
  try {
    const resultado = await vendaArquivoService.listarArquivos(req.params.id, req.usuario.id);
    return res.json(resultado);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao listar arquivos da venda.'
    });
  }
}

/**
 * Anexa arquivos a uma venda.
 *
 * @param {import('express').Request} req - Requisicao multipart com arquivos.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Arquivos gravados.
 */
async function store(req, res) {
  try {
    const arquivo = await vendaArquivoService.receberArquivoUpload(req, req.params.id, req.usuario.id);
    return res.status(201).json(arquivo);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao enviar arquivo.'
    });
  }
}

/**
 * Baixa um arquivo anexado a venda.
 *
 * @param {import('express').Request} req - Requisicao com id do arquivo em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Stream do arquivo ou erro.
 */
async function download(req, res) {
  try {
    const arquivo = await vendaArquivoService.prepararDownloadArquivo(
      req.params.id,
      req.params.arquivoVendaId,
      req.usuario.id
    );

    res.setHeader('Content-Type', arquivo.mimeType);
    res.setHeader('Content-Length', arquivo.tamanhoBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeDownload(arquivo.nome)}"`);
    return arquivo.stream.pipe(res);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao baixar arquivo.'
    });
  }
}

/**
 * Exibe um arquivo anexado inline quando suportado.
 *
 * @param {import('express').Request} req - Requisicao com id do arquivo em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Stream inline do arquivo.
 */
async function view(req, res) {
  try {
    const arquivo = await vendaArquivoService.prepararDownloadArquivo(
      req.params.id,
      req.params.arquivoVendaId,
      req.usuario.id
    );

    res.setHeader('Content-Type', arquivo.mimeType);
    res.setHeader('Content-Length', arquivo.tamanhoBytes);
    res.setHeader('Content-Disposition', `inline; filename="${nomeDownload(arquivo.nome)}"`);
    return arquivo.stream.pipe(res);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao visualizar arquivo.'
    });
  }
}

/**
 * Remove um arquivo anexado a venda.
 *
 * @param {import('express').Request} req - Requisicao com id do arquivo em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Status 204 quando removido.
 */
async function destroy(req, res) {
  try {
    const total = await vendaArquivoService.excluirArquivoVenda(
      req.params.id,
      req.params.arquivoVendaId,
      req.usuario.id
    );

    if (!total) {
      return res.status(404).json({ message: 'Arquivo nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao excluir arquivo.'
    });
  }
}

/**
 * Retorna o pacote de arquivos de uma venda.
 *
 * @param {import('express').Request} req - Requisicao com vendaId em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Dados do pacote.
 */
async function pacoteShow(req, res) {
  try {
    const pacote = await vendaArquivoService.obterPacote(req.params.id, req.usuario.id);
    return res.json(pacote || { status: 'inexistente' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao buscar pacote.'
    });
  }
}

/**
 * Cria ou atualiza o pacote de arquivos de uma venda.
 *
 * @param {import('express').Request} req - Requisicao multipart com arquivos do pacote.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Pacote atualizado.
 */
async function pacoteStore(req, res) {
  try {
    const pacote = await vendaArquivoService.solicitarPacoteVenda(req.params.id, req.usuario.id, { forcar: true });
    return res.status(202).json(pacote);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao gerar pacote.'
    });
  }
}

/**
 * Baixa o pacote de arquivos de uma venda.
 *
 * @param {import('express').Request} req - Requisicao com vendaId em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Stream do pacote.
 */
async function pacoteDownload(req, res) {
  try {
    const pacote = await vendaArquivoService.prepararDownloadPacote(req.params.id, req.usuario.id);

    res.setHeader('Content-Type', pacote.mimeType);
    res.setHeader('Content-Length', pacote.tamanhoBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeDownload(pacote.nome)}"`);
    return pacote.stream.pipe(res);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao baixar pacote.'
    });
  }
}

module.exports = {
  index,
  store,
  download,
  view,
  destroy,
  pacoteShow,
  pacoteStore,
  pacoteDownload
};
