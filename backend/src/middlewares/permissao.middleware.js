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

  const permissoesUsuario = parsePermissoes(usuario.permissoes);
  const permissoesRole = parsePermissoes(usuario.role?.permissoes);

  return permissoesUsuario.includes(permissao) || permissoesRole.includes(permissao);
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
        message: 'Voce nao tem permissao para executar esta acao.'
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao validar permissoes.'
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

function exigirAdminParaAlterarAdmin(req, res, next) {
  return Promise.resolve()
    .then(async () => {
      const solicitanteEhAdmin = await usuarioEhAdmin(req.usuario?.id);

      if (Number(req.body?.role_id) === 1 && !solicitanteEhAdmin) {
        return res.status(403).json({
          message: 'Apenas administradores podem promover usuarios para administrador.'
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
        message: 'Erro ao validar permissoes.'
      });
    });
}

function impedirAutoExclusao(req, res, next) {
  if (Number(req.params.id) === Number(req.usuario?.id)) {
    return res.status(403).json({
      message: 'Voce nao pode excluir o proprio usuario.'
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
  exigirPermissao,
  exigirUmaPermissao,
  exigirAdminParaAlterarAdmin,
  impedirAutoExclusao,
  exigirGerenciamentoPermissoesSeNecessario
};
