const express = require('express');
const router = express.Router();

const cnpjController = require('../controllers/cnpj.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/:cnpj', cnpjController.consultar);

module.exports = router;
