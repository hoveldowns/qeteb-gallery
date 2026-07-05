// Qeteb Meriri gallery — tiny static server.
// This is the seed of the "drops" product: static gallery today,
// generate/save/x402 endpoints get added here later.
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`qeteb-gallery running on port ${PORT}`));
