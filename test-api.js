/**
 * DeepSeek API Test Script
 * Use this script to test your API key and endpoint configuration
 */

require('dotenv').config();
const axios = require('axios');

// Helper function to sanitize API keys
function sanitizeApiKey(apiKey) {
  if (!apiKey) return '';
  return apiKey.trim()
    .replace(/\r?\n|\r/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, '');
}

// Helper function to mask an API key for display
function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 6) return '[INVALID]';
  return `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`;
}

// Helper function to remove trailing slashes from URLs
function normalizeUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function testDeepSeekApiConnection() {
  console.log('\n===== DEEPSEEK API CONNECTION TEST =====\n');
  
  // Get configuration from environment
  const apiKey = sanitizeApiKey(process.env.DEEPSEEK_API_KEY);
  const apiEndpoint = normalizeUrl(process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com');
  
  console.log(`API Key: ${maskApiKey(apiKey)} (${apiKey ? apiKey.length : 0} characters)`);
  console.log(`API Endpoint: ${apiEndpoint}`);
  
  if (!apiKey) {
    console.error('❌ ERROR: No API key found in environment variables');
    console.log('Please set DEEPSEEK_API_KEY in your .env file');
    return false;
  }
  
  // Array of possible API endpoints to try
  const endpointsToTry = [
    '/health',
    '/v1/health',
    '/api/health',
    '/v1/models',
    '/api/v1/models'
  ];
  
  console.log('\nTesting API connectivity...');
  
  for (const endpoint of endpointsToTry) {
    const fullUrl = `${apiEndpoint}${endpoint}`;
    console.log(`\nTrying endpoint: ${fullUrl}`);
    
    try {
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log(`✅ SUCCESS! Status code: ${response.status}`);
      console.log('Response:', response.data ? JSON.stringify(response.data, null, 2).substring(0, 500) : 'No response data');
      return true;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log('Response data:', error.response.data);
      }
    }
  }
  
  console.log('\n❌ All endpoint tests failed');
  console.log('Please check your API key and endpoint configuration');
  return false;
}

async function testProductSearch() {
  console.log('\n===== DEEPSEEK PRODUCT SEARCH TEST =====\n');
  
  // Get configuration from environment
  const apiKey = sanitizeApiKey(process.env.DEEPSEEK_API_KEY);
  const apiEndpoint = normalizeUrl(process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com');
  
  if (!apiKey) {
    console.error('❌ ERROR: No API key found in environment variables');
    return false;
  }
  
  // Array of possible product search endpoints to try
  const endpointsToTry = [
    '/product/search',
    '/v1/product/search',
    '/api/product/search',
    '/api/v1/product/search'
  ];
  
  const testQuery = 'best budget toaster 2023';
  console.log(`Testing product search with query: "${testQuery}"`);
  
  // Simple test payload
  const payload = {
    query: testQuery,
    temperature: 0.3,
    max_tokens: 1000
  };
  
  for (const endpoint of endpointsToTry) {
    const fullUrl = `${apiEndpoint}${endpoint}`;
    console.log(`\nTrying endpoint: ${fullUrl}`);
    
    try {
      const response = await axios.post(fullUrl, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log(`✅ SUCCESS! Status code: ${response.status}`);
      console.log('Response structure:', Object.keys(response.data));
      
      // Log summary of results
      if (response.data && response.data.products && Array.isArray(response.data.products)) {
        console.log(`\nProduct results: ${response.data.products.length}`);
        response.data.products.forEach((product, index) => {
          console.log(`\nProduct ${index + 1}: ${product.product_name || 'Unnamed'}`);
          console.log(`Price: ${product.average_price || 'N/A'}`);
          console.log(`Rating: ${product.star_rating || 'N/A'}`);
        });
      } else {
        console.log('No product results found in response');
      }
      
      return true;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log('Response data:', error.response.data);
      }
    }
  }
  
  console.log('\n❌ All product search endpoint tests failed');
  return false;
}

// Run the tests
async function runTests() {
  try {
    console.log('Starting DeepSeek API tests...');
    
    // First test basic connectivity
    const connectionSuccess = await testDeepSeekApiConnection();
    
    // Only test product search if basic connectivity succeeds
    if (connectionSuccess) {
      await testProductSearch();
    }
    
    console.log('\n===== TEST COMPLETE =====');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests(); 