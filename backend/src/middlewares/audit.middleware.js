const auditLogService = require('../services/audit-log.service');

function resolverValor(valor, req, body) {
  if (typeof valor === 'function') {
    return valor(req, body);
  }

  return valor;
}

function auditar(config) {
  return function auditMiddleware(req, res, next) {
    const jsonOriginal = res.json.bind(res);
    const sendOriginal = res.send.bind(res);
    let registrado = false;

    function registrarSeSucesso(body) {
      const statusCode = res.statusCode;

      if (!registrado && statusCode >= 200 && statusCode < 400) {
        registrado = true;

        auditLogService.registrarSemBloquear(req, {
          acao: resolverValor(config.acao, req, body),
          entidade: resolverValor(config.entidade, req, body),
          entidade_id: resolverValor(config.entidade_id, req, body),
          dados: resolverValor(config.dados, req, body)
        });
      }
    }

    res.json = function jsonComAuditoria(body) {
      registrarSeSucesso(body);
      return jsonOriginal(body);
    };

    res.send = function sendComAuditoria(body) {
      registrarSeSucesso(body);
      return sendOriginal(body);
    };

    return next();
  };
}

module.exports = {
  auditar
};
