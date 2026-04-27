const auditLogService = require('../services/audit-log.service');

async function index(req, res) {
  try {
    const logs = await auditLogService.listar({
      busca: req.query.busca,
      limite: req.query.limite
    });

    return res.json(logs);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar historico.'
    });
  }
}

module.exports = {
  index
};
