const express = require('express');
const router = express.Router();

const vendaController = require('../controllers/venda.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/vendedoras', exigirUmaPermissao(['vendas', 'vendas_ver_proprias', 'vendas_ver_todas']), vendaController.vendedoras);
router.get('/', exigirUmaPermissao(['vendas_ver_proprias', 'vendas_ver_todas']), vendaController.index);
router.get('/:id', exigirUmaPermissao(['vendas_ver_proprias', 'vendas_ver_todas']), vendaController.show);
router.post(
  '/',
  exigirUmaPermissao(['vendas_criar']),
  auditar({
    acao: 'venda.criada',
    entidade: 'vendas',
    entidade_id: (req, venda) => venda?.id,
    dados: (req, venda) => ({
      venda,
      payload: req.body
    })
  }),
  vendaController.store
);
router.put(
  '/:id',
  exigirUmaPermissao(['vendas_editar']),
  auditar({
    acao: 'venda.atualizada',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id,
      alteracoes: req.body
    })
  }),
  vendaController.update
);
router.patch(
  '/:id/status',
  exigirUmaPermissao(['vendas_editar']),
  auditar({
    acao: 'venda.status_atualizado',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id,
      alteracoes: req.body
    })
  }),
  vendaController.updateStatus
);
router.delete(
  '/:id',
  exigirUmaPermissao(['vendas_excluir']),
  auditar({
    acao: 'venda.excluida',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  vendaController.destroy
);

module.exports = router;
