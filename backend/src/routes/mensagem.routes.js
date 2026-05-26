const express = require('express');
const router = express.Router();

const mensagemController = require('../controllers/mensagem.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);
router.use(exigirPermissao('chat_usar'));

router.get('/contatos', mensagemController.contatos);
router.get('/conversas', mensagemController.conversas);
router.get('/nao-lidas', mensagemController.naoLidas);
router.get('/conversas/:contatoId', mensagemController.mensagens);
router.patch('/conversas/:contatoId/lida', mensagemController.marcarLida);
router.post('/anexos', mensagemController.uploadAnexo);
router.get('/anexos/:mensagemArquivoId', mensagemController.baixarAnexo);
router.post('/', mensagemController.enviar);
router.delete('/:id', mensagemController.excluir);

module.exports = router;
