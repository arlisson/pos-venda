const fechamentoService = require('../services/fechamento.service');

/**
 * Retorna o resumo gerencial do fechamento conforme filtros.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Resumo do fechamento.
 */
async function resumo(req, res) {
  try {
    const dados = await fechamentoService.obterResumo(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar resumo de fechamento.' });
  }
}

/**
 * Retorna detalhes das vendas consideradas no fechamento.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Detalhes de vendas.
 */
async function detalhes(req, res) {
  try {
    const dados = await fechamentoService.obterDetalhes(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar detalhes de vendas.' });
  }
}

/**
 * Retorna detalhes agrupados por chip para o fechamento.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Detalhes por chip.
 */
async function detalhesChips(req, res) {
  try {
    const dados = await fechamentoService.obterDetalhesChips(req.query);
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao carregar detalhes por chip.' });
  }
}

/**
 * Retorna o dossie de uma venda dentro do fechamento mensal.
 *
 * @param {import('express').Request} req - Requisicao com id da venda em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Dossie da venda ou erro 404.
 */
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

/**
 * Exporta as vendas do periodo filtrado em planilha XLSX.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Arquivo XLSX para download.
 */
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
