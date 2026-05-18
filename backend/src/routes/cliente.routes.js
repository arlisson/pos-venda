const express = require('express');
const router = express.Router();

const clienteController = require('../controllers/cliente.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirAdmin, exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/lixeira', exigirUmaPermissao(['clientes_ver_proprios', 'clientes_ver_todos']), clienteController.lixeira);
router.get('/select', exigirUmaPermissao(['clientes_ver_proprios', 'clientes_ver_todos']), clienteController.select);
router.get('/', exigirUmaPermissao(['clientes_ver_proprios', 'clientes_ver_todos']), clienteController.index);
router.post(
  '/importar-base-anterior/preview',
  exigirUmaPermissao(['clientes_criar']),
  clienteController.previewImportacaoBaseAnterior
);
router.post(
  '/importar-base-anterior',
  exigirUmaPermissao(['clientes_criar']),
  auditar({
    acao: 'clientes.base_anterior_importada',
    entidade: 'clientes',
    entidade_id: null,
    dados: (req, resultado) => resultado
  }),
  clienteController.importarBaseAnterior
);
router.delete(
  '/base-anterior',
  exigirAdmin,
  auditar({
    acao: 'clientes.base_anterior_limpa',
    entidade: 'clientes',
    entidade_id: null,
    dados: (req, resultado) => resultado
  }),
  clienteController.limparBaseAnterior
);
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
router.put(
  '/:id/dono',
  exigirUmaPermissao(['clientes_atribuir_vendedora']),
  auditar({
    acao: 'cliente.dono_atribuido',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id,
      usuario_id: req.body?.usuario_id
    })
  }),
  clienteController.atribuirDono
);
router.delete(
  '/:id/definitivo',
  exigirUmaPermissao(['clientes_excluir']),
  auditar({
    acao: 'cliente.excluido_definitivamente',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  clienteController.destroyDefinitivo
);
router.post(
  '/:id/restaurar',
  exigirUmaPermissao(['clientes_excluir']),
  auditar({
    acao: 'cliente.restaurado',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  clienteController.restore
);
router.delete(
  '/:id',
  exigirUmaPermissao(['clientes_excluir']),
  auditar({
    acao: 'cliente.enviado_lixeira',
    entidade: 'clientes',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  clienteController.destroy
);

module.exports = router;
