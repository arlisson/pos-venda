const express = require('express');
const router = express.Router();

const configController = require('../controllers/config.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/operadoras', configController.operadoras);
router.get('/links-externos', configController.linksExternos);

router.get('/admin/operadoras', exigirPermissao('crud_operadoras'), configController.adminOperadoras);
router.post('/admin/operadoras', exigirPermissao('crud_operadoras'), configController.criarOperadora);
router.put('/admin/operadoras/:id', exigirPermissao('crud_operadoras'), configController.atualizarOperadora);
router.delete('/admin/operadoras/:id', exigirPermissao('crud_operadoras'), configController.excluirOperadora);

router.get('/admin/links-externos', exigirPermissao('crud_links'), configController.adminLinksExternos);
router.post('/admin/links-externos', exigirPermissao('crud_links'), configController.criarLinkExterno);
router.put('/admin/links-externos/:id', exigirPermissao('crud_links'), configController.atualizarLinkExterno);
router.delete('/admin/links-externos/:id', exigirPermissao('crud_links'), configController.excluirLinkExterno);

module.exports = router;
