const Usuario = require('../models/Usuario');
const { usuarioTemPermissaoLocal } = require('../utils/permissoes');

async function usuarioTemPermissao(usuarioId, permissao) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return false;
  }

  return usuarioTemPermissaoLocal(usuario, permissao);
}

function exigirPermissao(permissao) {
  return async function permissaoMiddleware(req, res, next) {
    try {
      const permitido = await usuarioTemPermissao(req.usuario?.id, permissao);

      if (!permitido) {
        return res.status(403).json({
          message: 'Você não tem permissão para executar esta ação.'
        });
      }

      return next();
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissões.'
      });
    }
  };
}

function exigirUmaPermissao(permissoes) {
  return async function permissaoMiddleware(req, res, next) {
    try {
      for (const permissao of permissoes) {
        const permitido = await usuarioTemPermissao(req.usuario?.id, permissao);

        if (permitido) {
          return next();
        }
      }

      return res.status(403).json({
        message: 'Você não tem permissão para executar esta ação.'
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissões.'
      });
    }
  };
}

async function usuarioEhAdmin(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  return usuario?.role?.nome === 'admin';
}

function exigirAdmin(req, res, next) {
  return Promise.resolve()
    .then(async () => {
      const solicitanteEhAdmin = await usuarioEhAdmin(req.usuario?.id);

      if (!solicitanteEhAdmin) {
        return res.status(403).json({
          message: 'Apenas administradores podem executar esta ação.'
        });
      }

      return next();
    })
    .catch((error) => {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissões.'
      });
    });
}

function exigirAdminParaAlterarAdmin(req, res, next) {
  return Promise.resolve()
    .then(async () => {
      const solicitanteEhAdmin = await usuarioEhAdmin(req.usuario?.id);

      if (Number(req.body?.role_id) === 1 && !solicitanteEhAdmin) {
        return res.status(403).json({
          message: 'Apenas administradores podem promover usuários para administrador.'
        });
      }

      if (!req.params.id) {
        return next();
      }

      const usuarioAlvo = await Usuario.query()
        .findById(req.params.id)
        .withGraphFetched('role');

      if (usuarioAlvo?.role?.nome === 'admin' && !solicitanteEhAdmin) {
        return res.status(403).json({
          message: 'Apenas administradores podem alterar ou excluir outro administrador.'
        });
      }

      return next();
    })
    .catch((error) => {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissões.'
      });
    });
}

function impedirAutoExclusao(req, res, next) {
  if (Number(req.params.id) === Number(req.usuario?.id)) {
    return res.status(403).json({
      message: 'Você não pode excluir o próprio usuário.'
    });
  }

  return next();
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
  exigirAdmin,
  exigirPermissao,
  exigirUmaPermissao,
  exigirAdminParaAlterarAdmin,
  impedirAutoExclusao,
  exigirGerenciamentoPermissoesSeNecessario
};
