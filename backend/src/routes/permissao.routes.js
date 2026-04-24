const express = require('express');
const router = express.Router();

const permissaoController = require('../controllers/permissao.controller');

// Rota para listar permissões
router.get('/', permissaoController.index);

// Rota para buscar permissão por ID
router.get('/:id', permissaoController.show);

// Rota para criar permissão
router.post('/', permissaoController.store);

module.exports = router;