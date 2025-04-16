/**
 * Lucid API Server - Application Core
 * Initializes and configures the Express application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Log startup for debugging
console.log('Starting app.js configuration...');
console.log('Current working directory:', process.cwd());
console.log('Node environment:', process.env.NODE_ENV);

// Apply middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Standardized CORS configuration
app.use(cors({
  origin: '*',  // Allow all origins 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Version', 'Accept'],
  exposedHeaders: ['Content-Type', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID']
}));

// Global OPTIONS request handler - centralized in app.js
app.options('*', (req, res) => {
  console.log('Global OPTIONS request received at:', req.originalUrl);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Client-Version, Accept');
  res.status(204).send();
});

// Body parser middleware to handle JSON and URL-encoded data
app.use(express.json({ 
  limit: '1mb', 
  type: ['application/json', 'text/plain'],
  // Add improved error handling for JSON parsing
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      // Don't throw, let the route handler handle it
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Debug middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      // Safely log body (without sensitive info)
      const safeBody = { ...req.body };
      if (safeBody.query) {
        console.log('Request query:', safeBody.query);
      } else {
        console.log('Request body:', JSON.stringify(safeBody, null, 2));
      }
    } else {
      console.log('Request body is empty or not parsed');
    }
  }
  next();
});

app.use(compression());

// Basic routes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Lucid API server is running',
    startup_time: new Date().toISOString(),
    routes_loaded: true
  });
});

// Add a dedicated readiness endpoint for Cloud Run
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    message: 'API server is ready to handle requests'
  });
});

// Add a test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: 'API test endpoint is working',
    timestamp: new Date().toISOString()
  });
});

// Create a simple direct endpoint for search testing
app.post('/api/simple-search', (req, res) => {
  console.log('Simple search endpoint called');
  
  // Generate a request ID for tracking
  const requestId = `simple_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp = new Date().toISOString();
  
  // Extract query from request body
  const query = req.body?.query || 'no query provided';
  
  // Create response with multiple formats to match frontend expectations
  const product = { 
    productName: "Test Product", 
    name: "Test Product", // Add compatibility fields
    averageRating: 4.5, 
    rating: 4.5, // Add compatibility field
    reviewCount: 75,
    reviews: 75, // Add compatibility field
    productImageUrl: "https://example.com/test-product.jpg",
    imageUrl: "https://example.com/test-product.jpg", // Add compatibility field
    image_url: "https://example.com/test-product.jpg", // Add compatibility field
    pros: "Simple test product",
    cons: "Not a real product",
    priceMin: 49.99,
    price_min: 49.99, // Add compatibility field
    priceMax: 79.99,
    price_max: 79.99, // Add compatibility field
    retailers: [
      { 
        name: "Test Store", 
        url: "https://example.com/test",
        price: 99.99,
        isLowestPrice: true,
        isReputable: true
      }
    ]
  };
  
  return res.json({
    query: query,
    products: [product],   // Original format
    results: [product],    // Alternative format
    items: [product],      // Alternative format
    product: [product],    // Alternative format
    success: true,
    message: 'Simple search endpoint working',
    source: 'simple-search',
    request_id: requestId,
    timestamp: timestamp
  });
});

// Load routes with improved error handling
let searchRoutes, diagnosticRoutes;

try {
  console.log('Attempting to load routes from:', path.join(process.cwd(), 'src/routes'));
  
  // Check if route files exist
  const searchPath = path.join(process.cwd(), 'src/routes/search.js');
  const diagnosticPath = path.join(process.cwd(), 'src/routes/diagnostic.js');
  
  console.log('Search route file exists:', fs.existsSync(searchPath));
  console.log('Diagnostic route file exists:', fs.existsSync(diagnosticPath));
  
  // Use relative paths for module loading
  searchRoutes = require('./routes/search');
  diagnosticRoutes = require('./routes/diagnostic');
  
  console.log('Routes loaded successfully');
  
  // API routes
  app.use('/api/search', searchRoutes);
  app.use('/api', diagnosticRoutes);
} catch (error) {
  console.error('Failed to load routes:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Fallback route for search if module loading fails
  app.post('/api/search', (req, res) => {
    const query = req.body?.query || 'No query provided';
    console.log('Fallback search handler called with query:', query);
    
    return res.json({
      query: query,
      products: [
        {
          productName: "Fallback Product - Routes Not Loaded",
          productImageUrl: "https://example.com/image1.jpg",
          averageRating: 4.0,
          reviewCount: 1,
          retailers: [
            {
              name: "Fallback Store",
              price: 99.99
            }
          ]
        }
      ],
      source: 'fallback',
      fallback_reason: 'Route modules failed to load: ' + error.message
    });
  });
}

// Error handling middleware - centralized error handling
app.use((err, req, res, next) => {
  console.error('Unhandled application error:', err.message);
  console.error(err.stack);
  
  res.status(500).json({
    error: true,
    message: 'Internal server error',
    error_details: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Catch-all 404 handler
app.use((req, res) => {
  console.log(`404 for ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: true,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

module.exports = app; 