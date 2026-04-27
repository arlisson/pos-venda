const express = require('express');
const router = express.Router();

const usuarioController = require('../controllers/usuario.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const {
  exigirPermissao,
  exigirGerenciamentoPermissoesSeNecessario
} = require('../middlewares/permissao.middleware');

router.use(authMiddleware);
router.use(exigirPermissao('crud_usuarios'));

router.get('/', usuarioController.index);
router.get('/:id', usuarioController.show);
router.post(
  '/',
  exigirGerenciamentoPermissoesSeNecessario,
  auditar({
    acao: 'usuario.criado',
    entidade: 'usuarios',
    entidade_id: (req, usuario) => usuario?.id,
    dados: (req, usuario) => ({
      usuario,
      payload: req.body
    })
  }),
  usuarioController.store
);
router.put(
  '/:id',
  exigirGerenciamentoPermissoesSeNecessario,
  auditar({
    acao: 'usuario.atualizado',
    entidade: 'usuarios',
    entidade_id: req => req.params.id,
    dados: (req, usuario) => ({
      usuario,
      alteracoes: req.body
    })
  }),
  usuarioController.update
);
router.delete(
  '/:id',
  auditar({
    acao: 'usuario.excluido',
    entidade: 'usuarios',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  usuarioController.destroy
);

module.exports = router;
