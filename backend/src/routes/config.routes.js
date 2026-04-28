const express = require('express');
const router = express.Router();

const configController = require('../controllers/config.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/operadoras', configController.operadoras);
router.get('/links-externos', configController.linksExternos);
router.get('/tipos-produto', configController.tiposProduto);
router.get('/tipos-venda', configController.tiposVenda);
router.get('/servicos', configController.servicos);

router.get('/admin/operadoras', exigirPermissao('crud_operadoras'), configController.adminOperadoras);
router.post('/admin/operadoras', exigirPermissao('crud_operadoras'), configController.criarOperadora);
router.put('/admin/operadoras/:id', exigirPermissao('crud_operadoras'), configController.atualizarOperadora);
router.delete('/admin/operadoras/:id', exigirPermissao('crud_operadoras'), configController.excluirOperadora);

router.get('/admin/tipos-produto', exigirPermissao('crud_tipos_produto'), configController.adminTiposProduto);
router.post('/admin/tipos-produto', exigirPermissao('crud_tipos_produto'), configController.criarTipoProduto);
router.put('/admin/tipos-produto/:id', exigirPermissao('crud_tipos_produto'), configController.atualizarTipoProduto);
router.delete('/admin/tipos-produto/:id', exigirPermissao('crud_tipos_produto'), configController.excluirTipoProduto);

router.get('/admin/tipos-venda', exigirPermissao('crud_tipos_venda'), configController.adminTiposVenda);
router.post('/admin/tipos-venda', exigirPermissao('crud_tipos_venda'), configController.criarTipoVenda);
router.put('/admin/tipos-venda/:id', exigirPermissao('crud_tipos_venda'), configController.atualizarTipoVenda);
router.delete('/admin/tipos-venda/:id', exigirPermissao('crud_tipos_venda'), configController.excluirTipoVenda);

router.get('/admin/servicos', exigirPermissao('crud_servicos'), configController.adminServicos);
router.post('/admin/servicos', exigirPermissao('crud_servicos'), configController.criarServico);
router.put('/admin/servicos/:id', exigirPermissao('crud_servicos'), configController.atualizarServico);
router.delete('/admin/servicos/:id', exigirPermissao('crud_servicos'), configController.excluirServico);

router.get('/admin/links-externos', exigirPermissao('crud_links'), configController.adminLinksExternos);
router.post('/admin/links-externos', exigirPermissao('crud_links'), configController.criarLinkExterno);
router.put('/admin/links-externos/:id', exigirPermissao('crud_links'), configController.atualizarLinkExterno);
router.delete('/admin/links-externos/:id', exigirPermissao('crud_links'), configController.excluirLinkExterno);

module.exports = router;
