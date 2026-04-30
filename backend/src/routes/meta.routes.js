const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/progresso/usuarios', exigirUmaPermissao(['metas_ver_usuarios']), metaController.progressoUsuarios);
router.get('/progresso', metaController.progresso);
router.get('/', metaController.index);

router.post('/', exigirUmaPermissao(['gerenciar_metas']), metaController.store);
router.post('/:id/resgatar', metaController.resgatar);

router.put('/', exigirUmaPermissao(['gerenciar_metas']), metaController.updateBulk); 

router.delete('/:id', exigirUmaPermissao(['gerenciar_metas']), metaController.destroy);

module.exports = router;
