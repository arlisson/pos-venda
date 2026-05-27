const jwt = require('jsonwebtoken');

/**
 * Middleware Express que valida JWT Bearer e expõe o usuario decodificado em req.usuario.
 *
 * @param {import('express').Request} req - Requisicao HTTP.
 * @param {import('express').Response} res - Resposta HTTP.
 * @param {import('express').NextFunction} next - Proximo middleware da cadeia.
 * @returns {void}
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: 'Token não informado.'
    });
  }

  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({
      message: 'Token inválido.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido ou expirado.'
    });
  }
}

module.exports = authMiddleware;
