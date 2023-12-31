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
let nodemailer = require('nodemailer');
const scopes = ["read_orders", "write_orders", "write_merchant_managed_fulfillment_orders"];
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

const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  port: 587,
  secure: false,
  auth: {
    user: "johnolson19920109@outlook.com",
    pass: "rcl1984119rcl"
  }
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
  const { shop, hmac, code, shopState } = req.query;
  // const stateCookie = cookie.parse(req.headers.cookie).shopState;
  // if (shopState !== stateCookie) {
  //   return res.status(400).send("Request origin cannot be found");
  // }
  if (shop && hmac && code) {
    // const queryParams = { ...req.query };
    // delete queryParams["hmac"];
    // delete queryParams["signature"];
    // const message = querystring.stringify(queryParams);
    // const providedHmac = Buffer.from(hmac, "utf-8");
    // const generatedHash = crypto
    //   .createHmac("sha256", apiSecret)
    //   .update(message)
    //   .digest("hex");
    // const hashEquals = crypto.timingSafeEqual(
    //   Buffer.from(generatedHash, "utf-8"),
    //   providedHmac
    // );
    // if (!hashEquals) {
    //   return res.status(400).send("HMAC validation failed");
    // }
    const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
    const accessTokenPayload = {
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    };
    try {
      const accessTokenResponse = await axios.post(
        accessTokenRequestUrl,
        accessTokenPayload
      );
      const apiAccessToken = accessTokenResponse.data.access_token;
      const apiRequestURL = `https://${shop}/admin/shop.json`;
      const apiRequestHeaders = {
        "X-Shopify-Access-Token": apiAccessToken,
      };
      console.log("accessToken", apiAccessToken)
      accessToken = apiAccessToken;
      const apiResponse = await axios.get(apiRequestURL, {
        headers: apiRequestHeaders,
      });
      res.send(apiResponse.data);
    } catch (error) {
      res
        .status(error.response?.status || 500)
        .send(error.response?.data);
    }
  } else {
    return res.status(400).send("Required parameter missing");
  }
};

exports.getWebhook = async (req, res, next) => {
  try {
    const { note, id, email } = req.body;
    console.log(note, id, email);
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
      let myorders;
      const apiRequestURL = `https://${shopifyDomain}/admin/orders.json`;
      const apiRequestHeaders = {
        "X-Shopify-Access-Token": accessToken,
      };
      const apiResponse = await axios.get(apiRequestURL, {
        headers: apiRequestHeaders,
      });
      myorders = apiResponse.data.orders;
      console.log(myorders)
      let orderId;
      if (myorders.length) {
        myorders.forEach(order => {
          if (order.customer.id === id) {
            orderId = order.id;
          }
        });
      }
      console.log("orderId", orderId);
      // const response = await axios.post(`https://app.digital-downloads.com/api/v1/orders/${orderId}/assets`, form, {
      //   headers: {
      //     ...form.getHeaders(),
      //     'X-Shopify-Access-Token': accessToken,
      //   },
      // });
      const emailContent = `Dear customer, your download package is ready! Please click the link below to access your files:\n\n${response.file_url}`;
      // await shopify.order.sendEmail(orderId, {
      //   subject: 'Your Download Package is Ready',
      //   body: emailContent,
      //   send_to_customer: true
      // });
      var mail = {
        from: "johnolson19920109@outlook.com",
        to: email,
        message: 'Your Download Package is Ready',
        text: emailContent
      }
      transporter.sendMail(mail, (err, data) => {
        if (err) {
          res.json({ status: 'fail' })
        } else {
          res.json({ status: 'success' })
        }
      })
      console.log('File attached and sent email!');
      res.status(200).json({ success: true, message: 'File attached to order and sent email!' });
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
