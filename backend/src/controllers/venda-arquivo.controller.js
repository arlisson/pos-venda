const vendaArquivoService = require('../services/venda-arquivo.service');

function nomeDownload(nome) {
  return String(nome || 'arquivo')
    .replace(/[\r\n"]/g, '')
    .trim() || 'arquivo';
}

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
