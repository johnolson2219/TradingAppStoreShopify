// shopifyService.js
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');
const util = require('util');
const request = require('request');
const post = util.promisify(request.post);
const Shopify = require('shopify-api-node');

const shopifyDomain = process.env.SHOPIFY_DOMAIN;
const forwardingAddress = process.env.FORWARDING_ADDRESS; // our ngrok url
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
let accessToken = process.env.ACCESS_TOKEN;
//let apiToken = 'Bearer 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';

const shopify = new Shopify({
    shopName: shopifyDomain,
    apiKey: apiKey,
    password: apiSecret,
});

const getOrderId = async (customerId) => {
    try {
        const orders = await shopify.order.list({ limit: 5 });
        let orderId;
        orders.forEach(order => {
            if (order.customer.id === customerId) {
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

// Function to attach the download URL to the order with the customer ID
const attachDownloadUrlToOrder = async (orderId, downloadUrl) => {
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
};

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

// Function to upload the text file using Shopify's Digital Download Assets API
const uploadTextFile = async (filePath, customerId) => {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const fileSize = stats.size;
    const fileMimeType = getFileMimeType(filePath);
    try {
        const response = await axios.post('/assets/signed', {
            name: fileName,
            size: fileSize,
            mime: fileMimeType,
        }).then((r) => r.data);

        if (response.file_url || true) {
            console.log('File uploaded successfully!');
            console.log('Asset ID:', response.data.id);
            console.log('Download URL:', response.data.download_url);

            // Remove the txt file after successful upload
            fs.unlinkSync(filePath);

            // Get the Order ID
            const orderId = await getOrderId(customerId);

            // Attach the file to the order
            await attachDownloadUrlToOrder(orderId, "response.data.download_url");
        } else {
            console.log('Failed to upload file. Error:', response.data);
        }
    }
    catch (error) {
        console.log('Error occurred while uploading file:', error.message);
    }
};

module.exports = {
    uploadTextFile,
    attachDownloadUrlToOrder,
};
