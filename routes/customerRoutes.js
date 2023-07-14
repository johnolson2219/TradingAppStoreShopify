// customerRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const nonce = require('nonce')();
const scopes = "write_products";
const cookie = require('cookie');
const querystring = require('querystring');
const crypto = require('crypto');
const customerController = require('../controllers/customerController');
const shopifyService = require('../services/shopifyService');

const shopifyDomain = process.env.SHOPIFY_DOMAIN;
const forwardingAddress = process.env.FORWARDING_ADDRESS; // our ngrok url
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;

router.get('/', (req, res) => {
    res.send('Customer GET request received');
});

router.post('/save-customer-note', async (req, res) => {
    const { note, id, email } = req.body;
    try {
        console.log("save note", note, id, email)
        const filePath = customerController.generateTextFile(note);
        const downloadUrl = await shopifyService.uploadTextFile(filePath, id);
        const order = await shopifyService.attachDownloadUrlToOrder(id, downloadUrl);
        console.log(downloadUrl)
        res.status(200).json({ success: true, message: 'Customer note saved successfully.' });
    } catch (error) {
        console.error('Error saving customer note:', error);
        res.status(500).json({ success: false, message: 'Failed to save customer note.' });
    }
});

router.post('/webhook', (req, res) => {
    const { note, id, email } = req.body;
    console.log("hook", note, id, email)
    axios.post('http://localhost:3000/customer/save-customer-note', {
        note,
        id,
        email,
    })
        .then((response) => {
            console.log('Save customer note response:', response.data);
        })
        .catch((error) => {
            console.error('Error saving customer note:', error);
        });
    res.sendStatus(200);
});

router.get("/shopify", (req, res) => {
    const shopName = req.query.shop;
    if (shopName) {
        const shopState = nonce();
        const redirectURL = forwardingAddress + "/customer/shopify/callback";
        const installUrl =
            "https://" +
            shopName +
            "/admin/oauth/authorize?client_id=" +
            apiKey +
            "&scope=" +
            scopes +
            "&state=" +
            shopState +
            "&redirect_uri=" +
            redirectURL;

        res.cookie("state", shopState);
        console.log(installUrl)
        res.redirect(installUrl);
    } else {
        return res.status(400).send('Missing "Shop Name" parameter!!');
    }
});

router.get("/shopify/callback", async (req, res) => {
    const { shop, hmac, code, shopState } = req.query;
    const stateCookie = cookie.parse(req.headers.cookie).shopState;
    if (shopState !== stateCookie) {
        return res.status(400).send("request origin cannot be found");
    }
    if (shop && hmac && code) {
        const Map = Object.assign({}, req.query);
        delete Map["hmac"];
        delete Map["signature"];
        const message = querystring.stringify(Map);
        const providedHmac = Buffer.from(hmac, "utf-8");
        const generatedHash = Buffer.from(
            crypto
                .createHmac("sha256", apiSecret)
                .update(message)
                .digest("hex"),
            "utf-8"
        );
        let hashEquals = false;
        try {
            hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
        } catch (e) {
            hashEquals = false;
        }
        if (!hashEquals) {
            return res.status(400).send("HMAC validation failed");
        }
        const accessTokenRequestUrl =
            "https://" + shop + "/admin/oauth/access_token";
        const accessTokenPayload = {
            client_id: apiKey,
            client_secret: apiSecret,
            code,
        };
        try {
            const accessTokenResponse = await axios.post(accessTokenRequestUrl, accessTokenPayload);
            const accessToken = accessTokenResponse.data.access_token;
            //shopifyService.accessToken = accessToken;
            const apiRequestURL = `https://${shop}/admin/shop.json`;
            const apiRequestHeaders = {
                "X-Shopify-Access-Token": accessToken,
            };
            console.log(accessToken, shop)
            // const apiResponse = await axios.get(apiRequestURL, { headers: apiRequestHeaders });
            // res.end(apiResponse.data);
        } catch (error) {
            res.status(error.response?.status || 500).send(error.response?.data || "Internal Server Error");
        }
    } else {
        return res.status(400).send("required parameter missing");
    }
});

module.exports = router;
