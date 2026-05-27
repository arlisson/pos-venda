const vendaAprovacaoService = require('../services/venda-aprovacao.service');

/**
 * Lista solicitacoes de aprovacao de vendas.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Solicitacoes encontradas.
 */
async function index(req, res) {
  try {
    const solicitacoes = await vendaAprovacaoService.listarSolicitacoes(req.query);
    return res.json(solicitacoes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar solicitações de aprovação.' });
  }
}

/**
 * Aprova uma solicitacao de venda.
 *
 * @param {import('express').Request} req - Requisicao com id em req.params e decisao em req.body.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Solicitacao aprovada.
 */
async function aprovar(req, res) {
  try {
    const solicitacao = await vendaAprovacaoService.aprovarSolicitacao(req.params.id, req.body, req.usuario.id);
    return res.json(solicitacao);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao aprovar solicitação.'
    });
  }
}

/**
 * Recusa uma solicitacao de venda.
 *
 * @param {import('express').Request} req - Requisicao com id em req.params e motivo em req.body.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Solicitacao recusada.
 */
async function recusar(req, res) {
  try {
    const solicitacao = await vendaAprovacaoService.recusarSolicitacao(req.params.id, req.body, req.usuario.id);
    return res.json(solicitacao);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao recusar solicitação.'
    });
  }
}

module.exports = {
  index,
  aprovar,
  recusar
};
