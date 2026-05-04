const notificacaoService = require('../services/notificacao.service');

async function index(req, res) {
  try {
    const dados = await notificacaoService.listarNotificacoes(req.usuario.id, req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar notificacoes.' });
  }
}

async function marcarLida(req, res) {
  try {
    await notificacaoService.marcarComoLida(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao marcar notificacao como lida.' });
  }
}

async function marcarTodasLidas(req, res) {
  try {
    await notificacaoService.marcarTodasComoLidas(req.usuario.id);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao marcar notificacoes como lidas.' });
  }
}

module.exports = {
  index,
  marcarLida,
  marcarTodasLidas
};
