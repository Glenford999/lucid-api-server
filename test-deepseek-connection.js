/**
 * DeepSeek API Connection Test Script
 * 
 * This script tests the connection to DeepSeek API using our improved
 * connection testing functions. It tries multiple endpoints patterns
 * and reports back which ones work.
 */

require('dotenv').config();
const { testDeepSeekApiConnection } = require('./src/utils/api-request');

// List of potential base endpoints to try
const endpoints = [
  process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com',
  'https://api.deepseek.com',
  'https://api.deepseek.ai',
  'https://api-prod.deepseek.com',
  'https://api.deepseek-api.com'
];

// Remove duplicates
const uniqueEndpoints = [...new Set(endpoints)];

// Get API key from environment
const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error('⚠️ No DEEPSEEK_API_KEY found in environment variables.');
  console.error('Please set this in your .env file or environment before running the test.');
  process.exit(1);
}

// Print test header
console.log('╔═══════════════════════════════════════════════╗');
console.log('║       DEEPSEEK API CONNECTION TEST             ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log();
console.log('API Key:', apiKey ? `${apiKey.substr(0, 3)}...${apiKey.substr(-3)}` : 'Not set');
console.log('Testing', uniqueEndpoints.length, 'unique base endpoints');
console.log();

// Function to test each endpoint
async function testEndpoints() {
  const results = [];
  
  for (const endpoint of uniqueEndpoints) {
    console.log(`🔍 Testing endpoint: ${endpoint}`);
    
    try {
      const startTime = Date.now();
      const result = await testDeepSeekApiConnection(apiKey, endpoint);
      const duration = Date.now() - startTime;
      
      results.push({
        endpoint,
        success: result.success,
        message: result.message,
        details: result.details,
        duration: `${duration}ms`
      });
      
      // Show immediate feedback
      if (result.success) {
        console.log(`✅ SUCCESS: ${endpoint} (${duration}ms)`);
        console.log(`   - Working endpoint: ${result.details?.endpoint || 'unknown'}`);
      } else {
        console.log(`❌ FAILED: ${endpoint} (${duration}ms)`);
        console.log(`   - Reason: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ ERROR testing ${endpoint}:`, error.message);
      results.push({
        endpoint,
        success: false,
        message: error.message
      });
    }
    
    console.log(); // Add spacing between tests
  }
  
  return results;
}

// Main function to run the tests and display summary
async function run() {
  try {
    const results = await testEndpoints();
    
    // Print summary table
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║              SUMMARY OF RESULTS               ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log();
    
    const working = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total Endpoints Tested: ${results.length}`);
    console.log(`Working Endpoints: ${working.length}`);
    console.log(`Failed Endpoints: ${failed.length}`);
    
    if (working.length > 0) {
      console.log();
      console.log('✅ WORKING ENDPOINTS:');
      working.forEach((result, i) => {
        console.log(`  ${i+1}. ${result.endpoint} (${result.duration})`);
        console.log(`     Health endpoint: ${result.details?.endpoint || 'unknown'}`);
        if (result.details?.baseUrl) {
          console.log(`     Base URL: ${result.details.baseUrl}`);
        }
      });
      
      console.log();
      console.log('RECOMMENDATION:');
      console.log(`Set DEEPSEEK_API_ENDPOINT to: ${working[0].endpoint}`);
      
      // If this is the first endpoint, check if it's already in the environment variables
      if (working[0].endpoint === process.env.DEEPSEEK_API_ENDPOINT) {
        console.log('✅ Your current environment setting is correct.');
      } else {
        console.log('⚠️ Update your environment variable or .env file!');
      }
    }
    
    console.log();
    console.log('Test completed at:', new Date().toISOString());
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 