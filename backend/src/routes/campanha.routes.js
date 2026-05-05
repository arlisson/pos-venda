const express = require('express');
const router = express.Router();
const campanhaController = require('../controllers/campanha.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/progresso/usuarios', exigirUmaPermissao(['campanhas_ver_usuarios']), campanhaController.progressoUsuarios);
router.get('/progresso', campanhaController.progresso);
router.get('/', campanhaController.index);

router.post('/', exigirUmaPermissao(['gerenciar_campanhas']), campanhaController.store);
router.post('/:id/resgatar', campanhaController.resgatar);

router.put('/', exigirUmaPermissao(['gerenciar_campanhas']), campanhaController.updateBulk); 

router.delete('/:id', exigirUmaPermissao(['gerenciar_campanhas']), campanhaController.destroy);

module.exports = router;
