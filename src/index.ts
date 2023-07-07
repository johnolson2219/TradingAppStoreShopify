const crypto = require("crypto");
const nonce = require("nonce");
const request = require("request-promise");
const querystring = require("querystring");
const cookie = require("cookie");
const express = require("express");

const app = express(); // initialize application
app.listen(3434, () => console.log("Application listening on port 3434!"));