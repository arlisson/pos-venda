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

async function enviar(req, res) {
  try {
    const mensagem = await mensagemService.enviarMensagem(
      req.usuario.id,
      req.body.destinatario_id,
      req.body.conteudo
    );
    return res.status(201).json(mensagem);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Erro ao enviar mensagem.' });
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

module.exports = {
  contatos,
  conversas,
  mensagens,
  enviar,
  naoLidas,
  marcarLida
};
