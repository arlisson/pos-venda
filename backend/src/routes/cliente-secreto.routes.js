const express = require('express');
const router = express.Router();

const clienteSecretoController = require('../controllers/cliente-secreto.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

const permissoesAcessarClientesSecretos = [
  'clientes_secretos_ver',
  'clientes_secretos_ver_todos',
  'clientes_secretos_criar',
  'clientes_secretos_editar',
  'clientes_secretos_excluir'
];

router.use(authMiddleware);

router.get('/', exigirUmaPermissao(['clientes_secretos_ver', 'clientes_secretos_ver_todos']), clienteSecretoController.index);
router.get('/documento/:documento', exigirUmaPermissao(['clientes_secretos_criar', 'clientes_secretos_editar']), clienteSecretoController.verificarDocumento);
router.get('/:id', exigirUmaPermissao(permissoesAcessarClientesSecretos), clienteSecretoController.show);
router.post(
  '/',
  exigirUmaPermissao(['clientes_secretos_criar']),
  auditar({
    acao: 'cliente_secreto.criado',
    entidade: 'clientes_secretos',
    entidade_id: (req, cliente) => cliente?.id,
    dados: (req, cliente) => ({ cliente, payload: req.body })
  }),
  clienteSecretoController.store
);
router.put(
  '/:id',
  exigirUmaPermissao(['clientes_secretos_editar']),
  auditar({
    acao: 'cliente_secreto.atualizado',
    entidade: 'clientes_secretos',
    entidade_id: req => req.params.id,
    dados: req => ({ id: req.params.id, alteracoes: req.body })
  }),
  clienteSecretoController.update
);
router.delete(
  '/:id',
  exigirUmaPermissao(['clientes_secretos_excluir']),
  auditar({
    acao: 'cliente_secreto.excluido',
    entidade: 'clientes_secretos',
    entidade_id: req => req.params.id,
    dados: req => ({ id: req.params.id })
  }),
  clienteSecretoController.destroy
);

module.exports = router;
