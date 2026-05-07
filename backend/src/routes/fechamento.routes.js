const express = require('express');
const router = express.Router();

const fechamentoController = require('../controllers/fechamento.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);
router.use(exigirPermissao('vendas_fechamento_mensal'));

router.get('/resumo', fechamentoController.resumo);
router.get('/detalhes', fechamentoController.detalhes);
router.get('/detalhes-chips', fechamentoController.detalhesChips);
router.get('/vendas/:id/dossie', fechamentoController.dossieVenda);

module.exports = router;
