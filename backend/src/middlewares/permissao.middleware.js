const Usuario = require('../models/Usuario');
const { usuarioTemPermissaoLocal } = require('../utils/permissoes');

/**
 * Verifica se um usuario ativo possui uma permissao efetiva.
 *
 * @param {number|string|undefined} usuarioId - Identificador do usuario autenticado.
 * @param {string} permissao - Chave da permissao exigida.
 * @returns {Promise<boolean>} Verdadeiro quando a permissao esta liberada.
 */
async function usuarioTemPermissao(usuarioId, permissao) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return false;
  }

  return usuarioTemPermissaoLocal(usuario, permissao);
}

/**
 * Cria middleware que exige uma permissao especifica.
 *
 * @param {string} permissao - Chave da permissao exigida.
 * @returns {import('express').RequestHandler} Middleware de autorizacao.
 */
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

/**
 * Cria middleware que exige ao menos uma permissao da lista.
 *
 * @param {string[]} permissoes - Chaves de permissoes aceitas.
 * @returns {import('express').RequestHandler} Middleware de autorizacao.
 */
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

/**
 * Indica se o usuario possui role administrativa.
 *
 * @param {number|string|undefined} usuarioId - Identificador do usuario autenticado.
 * @returns {Promise<boolean>} Verdadeiro quando o usuario e admin.
 */
async function usuarioEhAdmin(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  return usuario?.role?.nome === 'admin';
}

/**
 * Bloqueia a rota quando o usuario autenticado nao e administrador.
 *
 * @param {import('express').Request} req - Requisicao autenticada.
 * @param {import('express').Response} res - Resposta HTTP.
 * @param {import('express').NextFunction} next - Proximo middleware.
 * @returns {Promise<import('express').Response|void>} Continua ou retorna erro 403.
 */
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

/**
 * Impede alteracoes administrativas feitas por usuarios nao administradores.
 *
 * @param {import('express').Request} req - Requisicao com usuario alvo ou role desejada.
 * @param {import('express').Response} res - Resposta HTTP.
 * @param {import('express').NextFunction} next - Proximo middleware.
 * @returns {Promise<import('express').Response|void>} Continua ou retorna erro 403.
 */
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

/**
 * Impede que o usuario autenticado exclua a propria conta.
 *
 * @param {import('express').Request} req - Requisicao com id do usuario alvo.
 * @param {import('express').Response} res - Resposta HTTP.
 * @param {import('express').NextFunction} next - Proximo middleware.
 * @returns {import('express').Response|void} Continua ou retorna erro 403.
 */
function impedirAutoExclusao(req, res, next) {
  if (Number(req.params.id) === Number(req.usuario?.id)) {
    return res.status(403).json({
      message: 'Você não pode excluir o próprio usuário.'
    });
  }

  return next();
}

/**
 * Exige permissao de gerenciamento quando a requisicao altera permissoes ou promove admin.
 *
 * @param {import('express').Request} req - Requisicao com dados do usuario em req.body.
 * @param {import('express').Response} res - Resposta HTTP.
 * @param {import('express').NextFunction} next - Proximo middleware.
 * @returns {import('express').Response|void} Continua ou delega ao middleware de permissao.
 */
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
