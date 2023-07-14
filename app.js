// app.js
require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const customerRoutes = require('./routes/customerRoutes');
 // Middleware
app.use(bodyParser.json());
 // Routes
 app.get('/', (req, res) => {
  res.send('Hello, welcome to my app!');
});
app.use('/customer', customerRoutes);
 // Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     