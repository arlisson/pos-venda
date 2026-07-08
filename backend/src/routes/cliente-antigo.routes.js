const express = require('express');
const router = express.Router();

const clienteAntigoController = require('../controllers/cliente-antigo.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/buscar', exigirPermissao('clientes_antigos_buscar'), clienteAntigoController.buscar);

router.get('/historico', exigirPermissao('clientes_antigos_ver_historico'), clienteAntigoController.historico);

router.post('/planilha/preview', exigirPermissao('clientes_antigos_gerenciar'), clienteAntigoController.planilhaPreview);
router.post('/planilha/importar', exigirPermissao('clientes_antigos_gerenciar'), clienteAntigoController.planilhaImportar);

module.exports = router;
