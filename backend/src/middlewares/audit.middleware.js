const auditLogService = require('../services/audit-log.service');

/**
 * Resolve valores estaticos ou funcoes de configuracao de auditoria.
 *
 * @param {unknown|Function} valor - Valor fixo ou funcao avaliadora.
 * @param {import('express').Request} req - Requisicao HTTP.
 * @param {unknown} body - Corpo enviado na resposta.
 * @returns {unknown} Valor resolvido.
 */
function resolverValor(valor, req, body) {
  if (typeof valor === 'function') {
    return valor(req, body);
  }

  return valor;
}

/**
 * Cria middleware que registra auditoria quando a resposta e bem-sucedida.
 *
 * @param {{ acao: unknown, entidade: unknown, entidade_id?: unknown, dados?: unknown }} config - Configuracao do evento.
 * @returns {import('express').RequestHandler} Middleware de auditoria.
 */
function auditar(config) {
  return function auditMiddleware(req, res, next) {
    const jsonOriginal = res.json.bind(res);
    const sendOriginal = res.send.bind(res);
    let registrado = false;

    /**
     * Registra o evento de auditoria apenas para respostas bem-sucedidas.
     */
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
