const express = require('express');
const app = express();
const PORT = 3342;
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const emailTokenAccess = process.env.EMAIL_TOKEN_ACCESS;
const scopes = "write_products";
const forwardingAddress = "https://5da2-108-43-14-13.eu.ngrok.io"; // our ngrok url
const fs = require('fs');
const moment = require('moment');
const axios = require('axios');
const nonce = require('nonce')();
const cookie = require('cookie');
const querystring = require('querystring');
const crypto = require('crypto');

const shopifyDomain = 'trading.store';
const Shopify = require('shopify-api-node');

const shopify = new Shopify({
    shopName: shopifyDomain,
    apiKey: apiKey,
    password: apiSecret,
});

shopify.auth.createAccessToken({
    code: apiSecret
})
    .then((response) => {
        accessToken = response.access_token;
        console.log('Access Token:', accessToken);
    })
    .catch((error) => {
        console.error('Error:', error);
    })

function createCatchyTextFile(fileContent) {
    const dateTimeStamp = moment().format('YYYYMMDD_HHMMSS');
    const fileName = `${dateTimeStamp}.txt`;

    fs.writeFile(fileName, fileContent, (err) => {
        if (err) {
            console.error('Error creating text file:', err);
        } else {
            console.log('Text file created successfully:', fileName);
            uploadFile(fileName);
        }
    })
}

async function attachFileToOrder(orderId, fileUrl) {
    const response = await axios.post(`https://app.digital-downloads.com/api/v1/orders/${orderId}/assets`, form, {
        headers: {
            ...form.getHeaders(),
            'X-Shopify-Access-Token': accessToken,
        },
    });

    if (response.status === 200) {
        const emailContent = `Dear customer, your download package is ready! Please click the link below to access your files:\n\n${fileUrl}?token=${emailTokenAccess}`;
        await shopify.order.sendEmail(orderId, {
            subject: 'Your Download Package is Ready',
            body: emailContent,
            send_to_customer: true
        });
        console.log('File attached to order successfully!');
    } else {
        console.log('Failed to attach file to order. Error:', response.data);
    }
}

async function getOrderId(customerNumber) {
    try {
        const orders = await shopify.order.list({ limit: 5 });
        let orderId;
        orders.forEach(order => {
            if (order.customer.id === customerNumber) {
                orderId = order.id;
            }
        });
        if (orderId) {
            return orderId;
        } else {
            throw new Error('Order not found for this customer');
        }
    } catch (error) {
        console.error('Error getting order:', error);
    }
}

async function uploadFile(filePath, customerId) {
    const file = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('file', file);

    try {
        const response = await axios.post('https://app.digital-downloads.com/api/v1/assets/signed', form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        if (response.status === 200) {
            console.log('File uploaded successfully!');
            console.log('Asset ID:', response.data.id);
            console.log('Download URL:', response.data.download_url);

            // Remove the txt file after successful upload
            fs.unlinkSync(filePath);

            // Get the Order ID
            const orderId = await getOrderId(customerId);

            // Attach the file to the order
            await attachFileToOrder(orderId, response.data.download_url);
        } else {
            console.log('Failed to upload file. Error:', response.data);
        }
    } catch (error) {
        console.log('Error occurred while uploading file:', error.message);
    }
};

app.get("/shopify", (req: any, res: any) => {
    const shopName = req.query.shop;
    if (shopName) {
        const shopState = nonce();
        const redirectURL = forwardingAddress + "/shopify/callback";
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

        // in a production app, the cookie should be encrypted
        // but, for the purpose of this application, we won't do that
        res.cookie("state", shopState);
        // redirect the user to the installUrl
        res.redirect(installUrl);
    } else {
        return res.status(400).send('Missing "Shop Name" parameter!!');
    }
});

app.get("/shopify/callback", (req: any, res: any) => {
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
                .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
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
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code,
        };
        request
            .post(accessTokenRequestUrl, { json: accessTokenPayload })

            .then((accessTokenResponse: any) => {
                const accessToken = accessTokenResponse.access_token;

                const apiRequestURL = `https:// + ${shop} + /admin/shop.json`;

                const apiRequestHeaders = {
                    "X-Shopify-Access-Token": accessToken,
                };

                request
                    .get(apiRequestURL, { headers: apiRequestHeaders })

                    .then((apiResponse: any) => {
                        res.end(apiResponse);
                    })

                    .catch((error: any) => {
                        res.status(error.statusCode).send(error.error.error_description);
                    });
            })

            .catch((error: any) => {
                res.status(error.statusCode).send(error.error.error_description);
            });
    } else {
        return res.status(400).send("required parameter missing");
    }
});

app.get("/shopify/customers", (req: any, res: any) => {
    const { customerNumber } = req.customer;
    if (customerNumber) {
        createCatchyTextFile(customerNumber);
    } else {
        return res.status(400).send('Missing "customerNumber" parameter!!');
    }
});

app.listen(PORT, () => console.log(`Application listening on port ${PORT}`));