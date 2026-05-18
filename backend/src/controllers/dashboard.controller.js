const vendaService = require('../services/venda.service');

async function notificacoesContexto(req, res) {
  try {
    const vendaIds = String(req.query.venda_ids || '')
      .split(',')
      .map(Number)
      .filter(Number.isInteger);
    const contexto = await vendaService.obterContextoDashboard({
      usuarioId: req.usuario.id,
      vendaIds
    });

    return res.json(contexto);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Erro ao carregar contexto do dashboard.'
    });
  }
}

module.exports = {
  notificacoesContexto
};
