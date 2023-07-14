// app.js
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const customerRoutes = require('./routes/customerRoutes');

app.use(bodyParser.json());

app.get('/', (req, res) => { res.send('Hello, welcome to my shopify node app!'); });
app.use('/customer', customerRoutes);

app.listen(3000, () => {
  console.log('Server started on port 3000');
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     