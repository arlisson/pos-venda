const Usuario = require('../models/Usuario');

function parsePermissoes(permissoes) {
  if (!permissoes) {
    return [];
  }

  if (Array.isArray(permissoes)) {
    return permissoes;
  }

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return Object.entries(parsed)
        .filter(([, permitido]) => permitido === true)
        .map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

async function usuarioTemPermissao(usuarioId, permissao) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return false;
  }

  if (usuario.role?.nome === 'admin') {
    return true;
  }

  return parsePermissoes(usuario.permissoes).includes(permissao);
}

function exigirPermissao(permissao) {
  return async function permissaoMiddleware(req, res, next) {
    try {
      const permitido = await usuarioTemPermissao(req.usuario?.id, permissao);

      if (!permitido) {
        return res.status(403).json({
          message: 'Voce nao tem permissao para executar esta acao.'
        });
      }

      return next();
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissoes.'
      });
    }
  };
}

function exigirGerenciamentoPermissoesSeNecessario(req, res, next) {
  const alteraPermissoes = Object.prototype.hasOwnProperty.call(req.body || {}, 'permissoes');
  const promoveAdmin = Number(req.body?.role_id) === 1;

  if (!alteraPermissoes && !promoveAdmin) {
    return next();
  }

  return exigirPermissao('gerenciar_permissoes')(req, res, next);
}

module.exports = {
  exigirPermissao,
  exigirGerenciamentoPermissoesSeNecessario
};
