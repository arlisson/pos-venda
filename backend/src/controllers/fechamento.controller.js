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

async function dossieVenda(req, res) {
  try {
    const dados = await fechamentoService.obterDossieVenda(req.params.id, req.query, req.usuario?.id);

    if (!dados) {
      return res.status(404).json({ message: 'Venda não encontrada.' });
    }

    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar dossiê da venda.' });
  }
}

async function exportarVendas(req, res) {
  try {
    const { buffer, nome } = await fechamentoService.gerarXlsxVendasPeriodo(req.query);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    return res.send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao exportar vendas do periodo.' });
  }
}

module.exports = {
  resumo,
  detalhes,
  detalhesChips,
  dossieVenda,
  exportarVendas
};
