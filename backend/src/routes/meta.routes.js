const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', metaController.index);

// Aqui apenas admins deveriam poder editar. Vamos assumir que quem tem 'crud_usuarios' também pode alterar metas, ou criar uma nova permissão 'configuracoes'
router.put('/', metaController.updateBulk); 

module.exports = router;
