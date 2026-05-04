const express = require('express');
const router = express.Router();

const planoController = require('../controllers/plano.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirUmaPermissao, exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

// Listagem aceita por qualquer usuario com fechamento mensal OU permissao basica de vendas
// (para popular o select de plano no formulario de venda).
router.get(
  '/',
  exigirUmaPermissao([
    'vendas_fechamento_mensal',
    'vendas',
    'vendas_criar',
    'vendas_editar',
    'vendas_ver_proprias',
    'vendas_ver_todas'
  ]),
  planoController.index
);

router.post('/', exigirPermissao('vendas_fechamento_mensal'), planoController.store);
router.put('/:id', exigirPermissao('vendas_fechamento_mensal'), planoController.update);
router.delete('/:id', exigirPermissao('vendas_fechamento_mensal'), planoController.destroy);

module.exports = router;
