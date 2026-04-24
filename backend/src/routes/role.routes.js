const express = require('express');
const router = express.Router();

const roleController = require('../controllers/role.controller');

router.get('/', roleController.index);
router.get('/:id', roleController.show);

module.exports = router;