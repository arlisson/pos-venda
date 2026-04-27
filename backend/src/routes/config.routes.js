const express = require('express');
const router = express.Router();

const configController = require('../controllers/config.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/operadoras', configController.operadoras);
router.get('/links-externos', configController.linksExternos);

module.exports = router;
