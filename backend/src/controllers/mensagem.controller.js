/**
 * Controller HTTP de mensagens internas.
 *
 * Controla contatos, conversas, envio, leitura, anexos e exclusao logica das
 * mensagens trocadas entre usuarios.
 */
const mensagemService = require('../services/mensagem.service');

async function contatos(req, res) {
  try {
    const lista = await mensagemService.listarContatos(req.usuario.id);
    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar contatos.' });
  }
}

async function conversas(req, res) {
  try {
    const lista = await mensagemService.listarConversas(req.usuario.id);
    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar conversas.' });
  }
}

async function todasConversas(req, res) {
  try {
    const lista = await mensagemService.listarTodasConversas();
    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar conversas internas.' });
  }
}

async function mensagens(req, res) {
  try {
    const lista = await mensagemService.listarMensagens(req.usuario.id, req.params.contatoId, {
      desde: req.query.desde,
      limit: req.query.limit
    });
    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao listar mensagens.' });
  }
}

async function mensagensConversaInterna(req, res) {
  try {
    const lista = await mensagemService.listarMensagensConversaInterna(req.params.conversaKey, {
      desde: req.query.desde,
      limit: req.query.limit
    });
    return res.json(lista);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao listar mensagens internas.' });
  }
}

async function enviar(req, res) {
  try {
    const mensagem = await mensagemService.enviarMensagem(
      req.usuario.id,
      req.body.destinatario_id,
      req.body.conteudo,
      req.body.arquivo_id,
      req.body.nome_arquivo
    );
    return res.status(201).json(mensagem);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao enviar mensagem.' });
  }
}

async function uploadAnexo(req, res) {
  try {
    const resultado = await mensagemService.uploadAnexo(req, req.usuario.id);
    return res.status(201).json(resultado);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro no upload do anexo.' });
  }
}

async function baixarAnexo(req, res) {
  try {
    const { stream, mimeType, tamanhoBytes, nome } = await mensagemService.prepararDownloadAnexo(
      req.usuario.id,
      req.params.mensagemArquivoId,
      { permitirQualquerConversa: false }
    );

    res.setHeader('Content-Type', mimeType);
    if (tamanhoBytes) res.setHeader('Content-Length', tamanhoBytes);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(nome)}`
    );

    stream.on('error', erro => {
      console.error(erro);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro ao ler anexo.' });
      } else {
        res.destroy(erro);
      }
    });

    stream.pipe(res);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao baixar anexo.' });
  }
}

async function baixarAnexoInterno(req, res) {
  try {
    const { stream, mimeType, tamanhoBytes, nome } = await mensagemService.prepararDownloadAnexo(
      req.usuario.id,
      req.params.mensagemArquivoId,
      { permitirQualquerConversa: true }
    );

    res.setHeader('Content-Type', mimeType);
    if (tamanhoBytes) res.setHeader('Content-Length', tamanhoBytes);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(nome)}`
    );

    stream.on('error', erro => {
      console.error(erro);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro ao ler anexo.' });
      } else {
        res.destroy(erro);
      }
    });

    stream.pipe(res);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao baixar anexo.' });
  }
}

async function naoLidas(req, res) {
  try {
    const dados = await mensagemService.contarNaoLidas(req.usuario.id);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao contar mensagens não lidas.' });
  }
}

async function marcarLida(req, res) {
  try {
    await mensagemService.marcarConversaLida(req.usuario.id, req.params.contatoId);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao marcar conversa como lida.' });
  }
}

async function excluir(req, res) {
  try {
    await mensagemService.excluirMensagem(req.usuario.id, req.params.id);
    return res.status(204).send();
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao excluir mensagem.' });
  }
}

module.exports = {
  contatos,
  conversas,
  todasConversas,
  mensagens,
  mensagensConversaInterna,
  enviar,
  naoLidas,
  marcarLida,
  uploadAnexo,
  baixarAnexo,
  baixarAnexoInterno,
  excluir
};
