const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
   app.use(cors({ 
     origin: '*',
     methods: ['GET', 'POST', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization']
   }));app.use(express.json());

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

// Product search endpoint using DeepSeek AI
app.post('/api/search', rateLimiterMiddleware, async (req, res) => {
  try {
    console.log('Product search request received:', req.body);
    const { query, priceFilter } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        error: true, 
        message: 'Search query is required' 
      });
    }
    
    // Mock data for testing
    // In production, replace this with actual API call to DeepSeek
    const mockProducts = [
      {
        productName: `${query} - Premium Model`,
        productImageUrl: 'https://via.placeholder.com/300',
        averageRating: 4.5,
        reviewCount: 128,
        pros: 'Great performance, excellent build quality',
        cons: 'Expensive, limited color options',
        priceMin: 99.99,
        priceMax: 149.99,
        retailers: [
          {
            name: 'Amazon',
            url: 'https://amazon.com',
            price: 99.99,
            isLowestPrice: true,
            isReputable: true
          },
          {
            name: 'Best Buy',
            url: 'https://bestbuy.com',
            price: 149.99,
            isLowestPrice: false,
            isReputable: true
          }
        ]
      },
      {
        productName: `${query} - Budget Option`,
        productImageUrl: 'https://via.placeholder.com/300',
        averageRating: 3.8,
        reviewCount: 84,
        pros: 'Good value, attractive price',
        cons: 'Average build quality, fewer features',
        priceMin: 49.99,
        priceMax: 79.99,
        retailers: [
          {
            name: 'Walmart',
            url: 'https://walmart.com',
            price: 49.99,
            isLowestPrice: true,
            isReputable: true
          },
          {
            name: 'Target',
            url: 'https://target.com',
            price: 79.99,
            isLowestPrice: false,
            isReputable: true
          }
        ]
      }
    ];
    
    // In production, you would call the DeepSeek API like this:
    /*
    const response = await axios.post('https://api.deepseek.com/v1/search', 
      { query, price_filter: priceFilter },
      { 
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const formattedResults = response.data.products.map(product => ({
      productName: product.name,
      productImageUrl: product.image_url,
      averageRating: product.rating,
      reviewCount: product.review_count,
      pros: product.pros,
      cons: product.cons,
      priceMin: product.price_min,
      priceMax: product.price_max,
      retailers: product.retailers
    }));
    */
    
    // For testing, we'll use the mock data
    res.json({ products: mockProducts });
    
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: true, 
      message: 'Failed to search products' 
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
  console.log(`Server running on port ${PORT}`);
}); 
