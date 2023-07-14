// customerController.js
const fs = require('fs');
const path = require('path');

const generateTextFile = (customerNote) => {
  const fileName = `customer_note_${Date.now()}.txt`;
  const filePath = path.join(__dirname, '..', 'views', fileName);
   // Check if customerNote is a valid string
  if (typeof customerNote !== 'string') {
    throw new Error('Invalid customer note');
  }
   fs.writeFileSync(filePath, customerNote);
  return filePath;
};

 module.exports = {
  generateTextFile,
};
