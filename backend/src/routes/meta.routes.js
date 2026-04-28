const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/', metaController.index);

router.post('/', exigirUmaPermissao(['gerenciar_metas']), metaController.store);

router.put('/', exigirUmaPermissao(['gerenciar_metas']), metaController.updateBulk); 

router.delete('/:id', exigirUmaPermissao(['gerenciar_metas']), metaController.destroy);

module.exports = router;
