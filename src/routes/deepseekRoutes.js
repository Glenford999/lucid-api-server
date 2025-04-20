const express = require('express');
const deepseekController = require('../controllers/deepseekController');

const router = express.Router();

// DeepSeek product search
router.post('/search', deepseekController.productSearch);

// DeepSeek product comparison
router.post('/compare', deepseekController.productComparison);

module.exports = router; 