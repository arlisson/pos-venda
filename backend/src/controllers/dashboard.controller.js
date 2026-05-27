const vendaService = require('../services/venda.service');

/**
 * Retorna o contexto de notificacoes das vendas exibidas no dashboard.
 *
 * @param {Object} req - Requisicao com venda_ids opcional em req.query.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Contexto consolidado do dashboard.
 */
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
