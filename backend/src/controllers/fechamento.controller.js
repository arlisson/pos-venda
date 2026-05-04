const fechamentoService = require('../services/fechamento.service');

async function resumo(req, res) {
  try {
    const dados = await fechamentoService.obterResumo(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar resumo de fechamento.' });
  }
}

async function detalhes(req, res) {
  try {
    const dados = await fechamentoService.obterDetalhes(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar detalhes de vendas.' });
  }
}

async function detalhesChips(req, res) {
  try {
    const dados = await fechamentoService.obterDetalhesChips(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar detalhes por chip.' });
  }
}

module.exports = {
  resumo,
  detalhes,
  detalhesChips
};
