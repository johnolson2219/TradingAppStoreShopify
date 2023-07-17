// customerRoutes.js
const express = require('express');
const router = express.Router();
const nonce = require('nonce')();
const scopes = "write_products";
const cookie = require('cookie');

// define controller
const customerController = require('../controllers/customerController');
//const shopifyService = require('../services/shopifyService');

router.get('/', (req, res) => { res.send('Customer GET request received'); });
// router.post('/save-customer-note', customerController.attachDownloadUrlToOrder);
router.post('/webhook', customerController.getWebhook);
router.get("/shopify", customerController.getShopify);
router.get("/shopify/callback", customerController.getShopifyCallback);

module.exports = router;
