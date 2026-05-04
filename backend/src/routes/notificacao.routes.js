const express = require('express');
const router = express.Router();

const notificacaoController = require('../controllers/notificacao.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', notificacaoController.index);
router.patch('/lidas', notificacaoController.marcarTodasLidas);
router.patch('/:id/lida', notificacaoController.marcarLida);

module.exports = router;
