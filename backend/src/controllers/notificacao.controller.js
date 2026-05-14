const notificacaoService = require('../services/notificacao.service');
const notificacaoEmailService = require('../services/notificacao-email.service');

async function index(req, res) {
  try {
    const dados = await notificacaoService.listarNotificacoes(req.usuario.id, req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar notificacoes.' });
  }
}

async function urgentes(req, res) {
  try {
    const notificacoes = await notificacaoService.listarUrgentes(req.usuario.id);
    return res.json({ notificacoes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar notificacoes urgentes.' });
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

async function marcarPopupVisto(req, res) {
  try {
    await notificacaoService.marcarPopupVisto(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao marcar popup como visto.' });
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

async function testarEmail(req, res) {
  try {
    const resultado = await notificacaoEmailService.enviarEmailTeste(req.usuario);
    return res.json({
      ...resultado,
      config: notificacaoEmailService.statusConfiguracao()
    });
  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao enviar email de teste.',
      config: notificacaoEmailService.statusConfiguracao()
    });
  }
}

module.exports = {
  index,
  urgentes,
  marcarLida,
  marcarPopupVisto,
  marcarTodasLidas,
  testarEmail
};
