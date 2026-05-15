const vendaAprovacaoService = require('../services/venda-aprovacao.service');

async function index(req, res) {
  try {
    const solicitacoes = await vendaAprovacaoService.listarSolicitacoes(req.query);
    return res.json(solicitacoes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar solicitações de aprovação.' });
  }
}

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
