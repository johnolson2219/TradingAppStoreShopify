// customerController.js
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const nonce = require('nonce');
const axios = require('axios');
const util = require('util');
const request = require('request');
const cookie = require('cookie');
const querystring = require('querystring');
const crypto = require('crypto');
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
  // const { shop, code, state } = req.query;
  // const stateCookie = req.cookies.state;
  // if (state !== stateCookie) {
  //   return res.status(403).send('Request origin cannot be verified');
  // }
  const redirectUri = `${forwardingAddress}/shopify/callback`;
  shopify["shopName"] = shop;
  shopify["apiKey"] = apiKey;
  shopify["password"] = apiSecret;
  shopify.oauth
    .accessToken(code, { redirectUri })
    .then((accessToken) => {
      // Store the access token in the database or session
      console.log(`Access token: ${accessToken}`);
      res.send('Authorization successful!');
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Something went wrong. Please try again later.');
    });
};

exports.getWebhook = async (req, res, next) => {
  try {
    const { note, id, email } = req.body;
    // generate txt file. 
    const fileName = `customer_note_${Date.now()}.txt`;
    const dirPath = path.join(__dirname, '..', 'views');
    const filePath = path.join(dirPath, fileName);
    if (typeof note !== 'string') {
      throw new Error('Invalid customer note');
    }
    // Check if directory exists, if not, create it
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    fs.writeFileSync(filePath, note);
    // upload txt file.
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fileMimeType = getFileMimeType(filePath);
    console.log("write file success!", fileName, fileSize, fileMimeType);
    axios.defaults.headers.common['Authorization'] = `Bearer iiZjHZEvapccAgmTQC3CLHH3Pi0DEFGtSqUQ7LjW2Hp3dbpCbQMxE7OdhoSznY0PSdI9l`;
    const response = await axios.post('https://app.digital-downloads.com/api/v1/assets/signed', {
      name: fileName,
      size: fileSize,
      mime: fileMimeType,
    }).then((r) => r.data);

    if (response.file_url) {
      console.log('File uploaded successfully!', response.file_url);
      // Remove the txt file after successful upload
      fs.unlinkSync(filePath);
      // Get the orderId
      // const orders = await axios.get('https://app.digital-downloads.com/api/v1/orders').then((r) => r.data);
      let myorders;
      shopify["accessToken"] = accessToken;
      myorders = await shopify.order.list();
      console.log(myorders)
      let orderId;
      if (myorders.length()) {
        myorders.forEach(order => {
          if (order.customer.id === id) {
            orderId = order.id;
          }
        });
      }
      console.log("orderId", orderId);
      if (!orderId) {
        console.log("Order not found for this customer");
      } else {
        console.log("success find order!");
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
      console.log('Failed to upload file. Error:', response);
    }
  } catch (err) {
    next(err);
  }
}

// module.exports = {
//   attachDownloadUrlToOrder,
//   getShopify,
//   getShopifyCallback,
//   getWebhook
// };
