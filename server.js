const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Better CORS configuration
app.use(cors({
  origin: '*', // In production, you should restrict this to specific domains
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Rate limiter setup
const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 1, // per 1 second
});

// Rate limiting middleware
const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).json({ 
      error: true,
      message: 'Too many requests, please try again later.'
    });
  }
};

// Environment variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Lucid API server is running' });
});

// Diagnostic endpoint for checking DeepSeek API connectivity
app.get('/api/diagnose', async (req, res) => {
  try {
    console.log('Running API diagnostics...');
    const diagnostics = {
      server: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      },
      deepseekApi: {
        configured: !!DEEPSEEK_API_KEY,
        endpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com'
      }
    };
    
    // Only test actual API connectivity if we have an API key
    if (DEEPSEEK_API_KEY) {
      try {
        console.log('Testing DeepSeek API connectivity...');
        const apiBaseUrl = process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com';
        
        // Test the chat completions endpoint
        const testResponse = await axios.post(`${apiBaseUrl}/v1/chat/completions`, 
          {
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: "Hello" }
            ],
            max_tokens: 10
          },
          {
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        ).catch(error => {
          // If there's an error response, the API is reachable but returned an error
          if (error.response) {
            return { status: error.response.status, data: error.response.data };
          }
          // Otherwise, it's a connection error
          throw error;
        });
        
        diagnostics.deepseekApi.connectivity = 'success';
        diagnostics.deepseekApi.details = {
          statusCode: testResponse.status,
          model: testResponse.data?.model || 'unknown',
          response: testResponse.data?.choices?.[0]?.message?.content || testResponse.data
        };
      } catch (apiError) {
        diagnostics.deepseekApi.connectivity = 'error';
        diagnostics.deepseekApi.details = {
          message: apiError.message,
          code: apiError.code,
          response: apiError.response?.data
        };
      }
    } else {
      diagnostics.deepseekApi.connectivity = 'error';
      diagnostics.deepseekApi.details = {
        message: 'API key is missing'
      };
    }
    
    console.log('Diagnostic results:', diagnostics);
    res.status(200).json(diagnostics);
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run diagnostics',
      error: error.message
    });
  }
});

// Product search endpoint using DeepSeek AI
app.post('/api/search', rateLimiterMiddleware, async (req, res) => {
  try {
    console.log('=== SEARCH FLOW START: APP → CLOUD RUN ===');
    console.log('Received request from app:', req.body);
    console.log('DeepSeek API Key present:', !!DEEPSEEK_API_KEY);
    
    const { query, priceFilter } = req.body;
    
    if (!query) {
      console.log('Error: Search query is missing');
      return res.status(400).json({ 
        error: true, 
        message: 'Search query is required' 
      });
    }
    
    // Ensure we have a valid API key
    if (!DEEPSEEK_API_KEY) {
      console.error('Error: DeepSeek API key is missing');
      return res.status(500).json({
        error: true,
        message: 'API configuration error: Missing API key'
      });
    }
    
    try {
      // Make the actual API call to DeepSeek
      console.log('=== SEARCH FLOW CONTINUE: CLOUD RUN → DEEPSEEK ===');
      console.log(`Attempting DeepSeek API call for query: "${query}"`);
      
      const apiBaseUrl = process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com';
      
      // Use DeepSeek's Chat Completions API with a structured prompt for product search
      const apiEndpoint = `${apiBaseUrl}/v1/chat/completions`;
      console.log(`Using API endpoint: ${apiEndpoint}`);
      
      // Make the actual API call with better error handling
      console.log('Making API request to DeepSeek with payload for product search');
      
      let response;
      try {
        // Using the chat completions API for product search
        response = await axios.post(apiEndpoint, 
          {
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: "You are a helpful shopping assistant. Provide detailed product information in a structured format."
              },
              {
                role: "user",
                content: `I'm looking for information about ${query}. Please provide details about various options, including pricing, features, pros, and cons.${priceFilter ? ` I'm interested in the ${typeof priceFilter === 'string' ? priceFilter : `around $${priceFilter}`} price range.` : ''}`
              }
            ],
            temperature: 0.7,
            max_tokens: 1000,
            response_format: { type: "json_object" }
          },
          { 
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 second timeout for better reliability
          }
        );
      } catch (networkError) {
        if (networkError.code === 'ECONNREFUSED' || networkError.code === 'ENOTFOUND' || 
            networkError.message.includes('connect') || networkError.message.includes('network')) {
          console.error('Network connectivity error to DeepSeek API:', networkError.message);
          return res.status(503).json({
            error: true,
            message: 'Cannot connect to search service. Please try again later.'
          });
        }
        
        if (networkError.code === 'ETIMEDOUT' || networkError.code === 'ESOCKETTIMEDOUT') {
          console.error('Timeout error connecting to DeepSeek API:', networkError.message);
          return res.status(504).json({
            error: true,
            message: 'Search service connection timed out. Please try again later.'
          });
        }
        
        throw networkError; // Re-throw to be caught by the outer catch block
      }
      
      console.log('=== SEARCH FLOW CONTINUE: DEEPSEEK → CLOUD RUN ===');
      console.log('DeepSeek API response status:', response.status);
      
      // Parse the AI-generated product data from the chat completion
      let products = [];
      
      try {
        const completionText = response.data.choices[0].message.content;
        
        // The response should be a JSON string
        const parsedData = JSON.parse(completionText);
        
        if (parsedData.products) {
          // Use the AI-generated product list directly
          products = parsedData.products;
        } else if (parsedData.recommendations) {
          // Alternative structure the AI might return
          products = parsedData.recommendations;
        } else {
          // Construct from raw response
          products = [
            {
              name: parsedData.name || parsedData.title || query,
              description: parsedData.description || parsedData.summary || "",
              features: parsedData.features || [],
              pros: parsedData.pros || "",
              cons: parsedData.cons || "",
              price_min: parsedData.price_min || parsedData.minPrice || 0,
              price_max: parsedData.price_max || parsedData.maxPrice || 0,
              rating: parsedData.rating || 0,
              review_count: parsedData.reviewCount || 0
            }
          ];
        }
      } catch (parsingError) {
        console.error('Error parsing AI response:', parsingError);
        console.log('Raw response:', response.data.choices[0].message.content);
        
        // Create a single generic product based on the query
        products = [
          {
            name: `${query}`,
            description: "No detailed information available",
            features: ["Generated from AI description"],
            pros: "Information not available",
            cons: "Information not available",
            price_min: 0,
            price_max: 0,
            rating: 0,
            review_count: 0
          }
        ];
      }
      
      console.log(`Processed ${products.length} products from AI response`);
      
      // Format the response data to match our app's expected structure
      const formattedResults = products.map(product => ({
        productName: product.name,
        productImageUrl: product.image_url || 'https://via.placeholder.com/300',
        averageRating: product.rating || 0,
        reviewCount: product.review_count || 0,
        pros: product.pros || 'No information available',
        cons: product.cons || 'No information available',
        priceMin: product.price_min || 0,
        priceMax: product.price_max || 0,
        retailers: product.retailers || []
      }));
      
      console.log('=== SEARCH FLOW COMPLETE: CLOUD RUN → APP ===');
      res.json({ products: formattedResults });
    } catch (apiError) {
      // Enhanced error logging
      console.error('=== SEARCH FLOW ERROR: DEEPSEEK → CLOUD RUN ===');
      console.error('DeepSeek API error details:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        responseData: apiError.response?.data,
        requestData: { query, priceFilter }
      });
      
      // Return an appropriate error response
      let statusCode = apiError.response?.status || 500;
      let errorMessage = apiError.response?.data?.message || apiError.message || 'Failed to search products';
      
      // Special handling for common errors
      if (apiError.response?.status === 401 || apiError.response?.status === 403) {
        errorMessage = 'Authentication error with search service. Please contact support.';
      } else if (apiError.response?.status === 404) {
        errorMessage = 'Search service endpoint not found. Please contact support.';
      } else if (apiError.code === 'ECONNABORTED') {
        statusCode = 504;
        errorMessage = 'Search request timed out. Please try again later.';
      }
      
      console.log(`=== SEARCH FLOW ERROR: CLOUD RUN → APP (ERROR ${statusCode}) ===`);
      return res.status(statusCode).json({
        error: true,
        message: errorMessage
      });
    }
  } catch (error) {
    console.error('Product search error:', error.message, error.stack);
    console.log('=== SEARCH FLOW FAILED: APP → CLOUD RUN → ERROR → APP ===');
    res.status(500).json({ 
      error: true, 
      message: 'Internal server error processing search request. Please try again later.' 
    });
  }
});

// Chat endpoint using OpenAI
app.post('/api/chat', rateLimiterMiddleware, async (req, res) => {
  try {
    console.log('Chat request received:', req.body);
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: true, 
        message: 'Messages are required and must be an array' 
      });
    }
    
    // Prepare messages for OpenAI API
    const openaiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add context as system message if available
    if (context) {
      let contextPrompt = 'You are a helpful shopping assistant. ';
      
      if (context.searchQuery) {
        contextPrompt += `The user is searching for: ${context.searchQuery}. `;
      }
      
      if (context.products && context.products.length > 0) {
        contextPrompt += 'Here is information about some relevant products:\n';
        context.products.forEach(product => {
          contextPrompt += `
- ${product.name}
  Pros: ${product.pros}
  Cons: ${product.cons}
`;
        });
      }
      
      openaiMessages.unshift({
        role: 'system',
        content: contextPrompt
      });
    }
    
    // Call OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const reply = response.data.choices[0].message.content;
    res.json({ reply });
    
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: true, 
      message: 'Failed to get AI response' 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`
==========================================
LUCID API SERVER STARTED
==========================================
- Port: ${PORT}
- DeepSeek API configured: ${!!DEEPSEEK_API_KEY}
- DeepSeek API Base URL: ${process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com'} 
- Environment: ${process.env.NODE_ENV || 'development'}
==========================================
Search flow: APP → CLOUD RUN → DEEPSEEK CHAT API → CLOUD RUN → APP
==========================================
  `);
});
