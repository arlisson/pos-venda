const express = require('express');
const router = express.Router();

const auditLogController = require('../controllers/audit-log.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', auditLogController.index);

module.exports = router;
