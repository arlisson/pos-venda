const auditLogService = require('../services/audit-log.service');
const vendaService = require('../services/venda.service');

async function index(req, res) {
  try {
    const logs = await auditLogService.listar({
      busca: req.query.busca,
      limite: req.query.limite,
      entidade: req.query.entidade
    });

    return res.json(logs);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar histórico.'
    });
  }
}

async function statusVendas(req, res) {
  try {
    const status = await vendaService.listarStatusVendasParaHistorico();
    return res.json(status);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar status das vendas.'
    });
  }
}

module.exports = {
  index,
  statusVendas
};
