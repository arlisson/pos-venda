const express = require('express');
const router = express.Router();

// Endpoints de planos removidos
router.get('/', (req, res) => res.status(404).json({ message: 'Planos removidos' }));

module.exports = router;
