const auditLogService = require('../services/audit-log.service');

/**
 * Lista eventos de auditoria conforme filtros de consulta.
 *
 * @param {import('express').Request} req - Requisicao com filtros em req.query.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Pagina de logs de auditoria.
 */
async function index(req, res) {
  try {
    const logs = await auditLogService.listar({
      busca: req.query.busca,
      entidade: req.query.entidade,
      tipo: req.query.tipo,
      page: req.query.page,
      per_page: req.query.per_page
    });

    return res.json(logs);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar histórico.'
    });
  }
}

/**
 * Lista historico de vendas agrupado para exibicao na tela de historico.
 *
 * @param {import('express').Request} req - Requisicao com filtros de status, busca e paginacao.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Historico de vendas agrupado.
 */
async function vendasAgrupado(req, res) {
  try {
    const resultado = await auditLogService.listarHistoricoVendasAgrupado({
      status: req.query.status,
      busca: req.query.busca,
      page: req.query.page,
      per_page: req.query.per_page
    });

    return res.json(resultado);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar histórico de vendas.'
    });
  }
}

module.exports = {
  index,
  vendasAgrupado
};
