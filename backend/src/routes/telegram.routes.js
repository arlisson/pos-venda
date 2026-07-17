const express = require('express');
const telegramWebhookService = require('../services/telegram-webhook.service');
const router = express.Router();
router.post('/webhook', telegramWebhookService.receberWebhook);
module.exports = router;
