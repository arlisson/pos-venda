const express = require('express');
const router = express.Router();

const clienteController = require('../controllers/cliente.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/', exigirUmaPermissao(['clientes_ver_proprios', 'clientes_ver_todos']), clienteController.index);
router.get('/:id', exigirUmaPermissao(['clientes_ver_proprios', 'clientes_ver_todos']), clienteController.show);
router.post(
  '/',
  exigirUmaPermissao(['clientes_criar']),
  auditar({
    acao: 'cliente.criado',
    entidade: 'clientes',
    entidade_id: (req, cliente) => cliente?.id,
    dados: (req, cliente) => ({
      cliente,
      payload: req.body
    })
  }),
  clienteController.store
);
router.put(
  '/:id',
  exigirUmaPermissao(['clientes_editar']),
  auditar({
    acao: 'cliente.atualizado',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id,
      alteracoes: req.body
    })
  }),
  clienteController.update
);
router.delete(
  '/:id',
  exigirUmaPermissao(['clientes_excluir']),
  auditar({
    acao: 'cliente.excluido',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  clienteController.destroy
);

module.exports = router;
