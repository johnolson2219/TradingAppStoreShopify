// customerController.js
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const nonce = require('nonce');
const axios = require('axios');
const util = require('util');
const request = require('request');
const post = util.promisify(request.post);
const scopes = "write_products";
const Shopify = require('shopify-api-node');

const shopifyDomain = process.env.SHOPIFY_DOMAIN;
const forwardingAddress = process.env.FORWARDING_ADDRESS; // our ngrok url
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
let accessToken = process.env.ACCESS_TOKEN;

const shopify = new Shopify({
  shopName: shopifyDomain,
  apiKey: apiKey,
  password: apiSecret,
});

function getFileMimeType(filePath) {
  const fileExtension = path.extname(filePath).toLowerCase();

  // Map common file extensions to MIME types
  const mimeTypes = {
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    // Add more mappings as needed
  };

  return mimeTypes[fileExtension] || 'application/octet-stream';
}

exports.attachDownloadUrlToOrder = async (req, res, next) => {
  try {
    const { note, id, email } = req.body;
    // generate txt file. 
    const fileName = `customer_note_${Date.now()}.txt`;
    const filePath = path.join(__dirname, '..', 'views', fileName);
    if (typeof note !== 'string') {
      throw new Error('Invalid customer note');
    }
    fs.writeFileSync(filePath, note);
    // upload txt file.
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileMimeType = getFileMimeType(filePath);
    const response = await axios.post('/assets/signed', {
      name: fileName,
      size: fileSize,
      mime: fileMimeType,
    }).then((r) => r.data);

    if (response.file_url) {
      console.log('File uploaded successfully!');
      console.log('Asset ID:', response.data.id);
      console.log('Download URL:', response.data.download_url);
      // Remove the txt file after successful upload
      fs.unlinkSync(filePath);
      // Get the orderId
      const orders = await shopify.order.list({});
      console.log("orders", orders)
      let orderId;
      if (orders.length()) {
        orders.forEach(order => {
          if (order.customer.id === customerId) {
            orderId = order.id;
          }
        });
      }
      if (!orderId) {
        console.log("Order not found for this customer");
      } else {
        console.log("sucess find order!");
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
          console.log('File attached to order and sent email!');
          res.status(200).json({ success: true, message: 'File attached to order and sent email!' });
        } else {
          console.log('Failed to attach file to order. Error:', response.data);
        }
      }
    } else {
      console.log('Failed to upload file. Error:', response.data);
    }
  } catch (err) {
    next(err);
  }
};

exports.getShopify = async (req, res, next) => {
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
}

exports.getShopifyCallback = async (req, res, next) => {
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
}

exports.getWebhook = async (req, res, next) => {
  const { note, id, email } = req.body;
  console.log("webhook request: ", id, note, email)
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
}

// module.exports = {
//   attachDownloadUrlToOrder,
//   getShopify,
//   getShopifyCallback,
//   getWebhook
// };
