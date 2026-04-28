const express = require('express');
const router = express.Router();

const auditLogController = require('../controllers/audit-log.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/', exigirPermissao('historico_visualizar'), auditLogController.index);

module.exports = router;
