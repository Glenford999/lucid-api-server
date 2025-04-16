/**
 * API Request Utilities
 * Handles connections to external APIs like DeepSeek and OpenAI
 */

const axios = require('axios');

// Function to test the DeepSeek API connection
async function testDeepSeekApiConnection(apiKey, apiEndpoint) {
  if (!apiKey || !apiEndpoint) {
    console.error('Missing DeepSeek API key or endpoint in test connection');
    return false;
  }

  try {
    console.log(`Testing DeepSeek API connection to ${apiEndpoint}`);
    
    // Create a basic test request to DeepSeek API
    const response = await axios({
      method: 'post',
      url: `${apiEndpoint}/v1/models`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Check if the response contains expected data
    if (response.status === 200 && response.data) {
      console.log('DeepSeek API connection successful');
      return true;
    } else {
      console.warn('DeepSeek API connection returned unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    // Log error details for debugging
    console.error('DeepSeek API connection test failed:', error.message);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      if (error.response.data) {
        console.error('Response data:', typeof error.response.data === 'object' ? 
          JSON.stringify(error.response.data).substring(0, 500) : 
          String(error.response.data).substring(0, 500));
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Request details:', 
        typeof error.request === 'object' ? 
        JSON.stringify(error.request).substring(0, 200) : 
        'Non-object request');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error during request setup:', error.message);
    }
    
    return false;
  }
}

// Function to test the OpenAI API connection
async function testOpenAIApiConnection(apiKey, apiEndpoint = 'https://api.openai.com') {
  if (!apiKey) {
    console.error('Missing OpenAI API key in test connection');
    return false;
  }

  try {
    console.log(`Testing OpenAI API connection to ${apiEndpoint}`);
    
    // Create a basic test request to OpenAI API
    const response = await axios({
      method: 'get',
      url: `${apiEndpoint}/v1/models`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Check if the response contains expected data
    if (response.status === 200 && response.data && response.data.data) {
      console.log('OpenAI API connection successful');
      return true;
    } else {
      console.warn('OpenAI API connection returned unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.error('OpenAI API connection test failed:', error.message);
    return false;
  }
}

// Make a request to the DeepSeek API
async function makeDeepSeekRequest(endpoint, apiKey, payload) {
  try {
    const config = require('../config/config');
    const apiEndpoint = config.deepseekApiEndpoint || 'https://api.deepseek.com';
    
    const response = await axios({
      method: 'post',
      url: `${apiEndpoint}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: payload,
      timeout: 60000, // 60 second timeout for completions
    });
    
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    console.error(`DeepSeek API request to ${endpoint} failed:`, error.message);
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500,
      data: error.response?.data || null
    };
  }
}

module.exports = {
  testDeepSeekApiConnection,
  testOpenAIApiConnection,
  makeDeepSeekRequest
}; 