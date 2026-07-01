const express = require('express');
const router = express.Router();

const cnpjController = require('../controllers/cnpj.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/google-places/keys', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.listarGooglePlacesKeys);
router.post('/google-places/keys', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.adicionarGooglePlacesKey);
router.delete('/google-places/keys/:id', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.removerGooglePlacesKey);
router.post('/planilha/preview', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.previewPlanilha);
router.post('/planilha/consultar', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.consultarPlanilha);
router.post('/planilha/consultar-stream', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.consultarPlanilhaStream);
router.post('/planilha/exportar', exigirUmaPermissao(['clientes_importar_planilhas']), cnpjController.exportarResultado);
router.post('/planilha/clientes', exigirUmaPermissao(['clientes_criar']), cnpjController.adicionarClientes);
router.get('/:cnpj', cnpjController.consultar);

module.exports = router;
