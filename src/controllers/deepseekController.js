const config = require('../config/config');
const axios = require('axios');

/**
 * Controller for handling DeepSeek AI product search
 */
exports.productSearch = async (req, res) => {
  try {
    const { query, context, filters, preferences } = req.body;
    
    // Validate request
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: query is required'
      });
    }
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      console.warn('DeepSeek API not configured, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key and endpoint.'
      });
    }
    
    console.log(`Making request to DeepSeek API at ${deepseekApiEndpoint} for query: "${query}"`);
    
    // Format request for DeepSeek API with enhanced shopping assistant prompt
    const promptTemplate = `Act as an expert Shopping Research Assistant. Analyze and return 6 optimal products for: [USER_QUERY_HERE]. Follow these steps:

1. Conduct comprehensive research across:
   - Professional review websites
   - Verified customer reviews from major e-commerce platforms
   - Forum discussions (Reddit, specialized communities)
   - YouTube video comparisons and expert analyses

2. For each product, structure findings with:
   - Comparative strengths/weaknesses against top competitors
   - Price analysis across multiple retailers
   - Authentic review sentiment aggregation

3. Format response as JSON with this exact structure:
{
  \"products\": [
    {
      \"product_name\": \"Full product name\",
      \"image_url\": \"Direct image link to product\",
      \"average_price\": Average market price in decimal,
      \"star_rating\": 0.0-5.0 rating,
      \"review_count\": Total reviews aggregated,
      \"pros\": \"Detailed paragraph comparing strengths to competitors\",
      \"cons\": \"Detailed paragraph comparing weaknesses to competitors\",
      \"purchasing_options\": [
        {
          \"retailer_name\": \"Retailer brand\",
          \"retailer_url\": \"Direct product page URL\",
          \"price\": Current price in decimal,
          \"is_lowest_price\": true/false,
          \"is_reputable\": true/false
        }
      ]
    }
  ]
}

Requirements:
- Include EXACTLY 4 purchasing options per product (2 lowest price, 2 reputable)
- Currency must match product's primary market (e.g., GBP, USD)
- Ensure all URLs are current and functional
- Use snake_case for all JSON keys
- Pros/cons must contain comparative analysis phrases like:
  'Compared to [Competitor], this product...'
  'While [Alternative] offers X, this model...'
- Prioritize recent reviews (<18 months) and current pricing
- Exclude markdown formatting
- Validate JSON syntax`;

    // Replace placeholder with actual query
    const enhancedPrompt = promptTemplate.replace('[USER_QUERY_HERE]', query);
    
    const deepseekRequest = {
      query,
      prompt: enhancedPrompt,
      temperature: 0.3,
      max_tokens: 4000,
      context: context || { search_type: 'product' },
      filters: filters || {},
      preferences: preferences || { include_pros_cons: true }
    };
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Add request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Debug the API key for troubleshooting
    console.log(`[${requestId}] API key length: ${deepseekApiKey ? deepseekApiKey.length : 0}`);
    console.log(`[${requestId}] API endpoint: ${deepseekApiEndpoint}`);
    
    // Clean the API key to ensure it doesn't contain invalid characters
    const sanitizedApiKey = deepseekApiKey ? deepseekApiKey.trim().replace(/\r?\n|\r/g, '') : '';
    
    // Create safe headers without any potentially problematic characters
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sanitizedApiKey}`,
      'X-Timestamp': timestamp,
      'Accept': 'application/json'
    };
    
    // Make the actual request to DeepSeek API with timeout and retry logic
    try {
      console.log(`[${requestId}] Sending request to DeepSeek API...`);
      
      // Additional diagnostic logging
      if (config.nodeEnv !== 'production') {
        console.log(`[${requestId}] Request headers:`, JSON.stringify({
          ...headers,
          'Authorization': headers.Authorization ? 'Bearer [REDACTED]' : undefined
        }));
        console.log(`[${requestId}] Request body:`, JSON.stringify({
          ...deepseekRequest,
          prompt: '[PROMPT HIDDEN]'
        }));
      }
      
      // Extract the base URL correctly - ensure it doesn't end with a slash
      const baseUrl = deepseekApiEndpoint.endsWith('/') 
        ? deepseekApiEndpoint.slice(0, -1) 
        : deepseekApiEndpoint;
      
      // Construct the full API URL - try direct path first
      const apiUrl = `${baseUrl}/product/search`;
      console.log(`[${requestId}] Trying API URL: ${apiUrl}`);
      
      try {
      const deepseekResponse = await axios.post(
          apiUrl,
        deepseekRequest,
        { 
          headers,
          timeout: 30000  // 30 second timeout
        }
      );
      
      console.log(`[${requestId}] DeepSeek API response received successfully`);
      
      // Process and format the response
      const processedResponse = processDeepSeekSearchResponse(deepseekResponse.data);
      
      return res.status(200).json({
        success: true,
        data: processedResponse,
        request_id: requestId
      });
      } catch (firstAttemptError) {
        // If first attempt fails, try with v1 prefix
        const v1ApiUrl = `${baseUrl}/v1/product/search`;
        console.log(`[${requestId}] First attempt failed with ${firstAttemptError.message}, trying alternate URL: ${v1ApiUrl}`);
        
        try {
          const deepseekResponse = await axios.post(
            v1ApiUrl,
            deepseekRequest,
            { 
              headers,
              timeout: 30000  // 30 second timeout
            }
          );
          
          console.log(`[${requestId}] DeepSeek API response received successfully from alternate URL`);
          
          // Process and format the response
          const processedResponse = processDeepSeekSearchResponse(deepseekResponse.data);
          
          return res.status(200).json({
            success: true,
            data: processedResponse,
            request_id: requestId
          });
        } catch (secondAttemptError) {
          // If both attempts fail, try with api prefix
          const apiPrefixUrl = `${baseUrl}/api/product/search`;
          console.log(`[${requestId}] Second attempt failed with ${secondAttemptError.message}, trying final URL: ${apiPrefixUrl}`);
          
          try {
            const deepseekResponse = await axios.post(
              apiPrefixUrl,
              deepseekRequest,
              { 
                headers,
                timeout: 30000  // 30 second timeout
              }
            );
            
            console.log(`[${requestId}] DeepSeek API response received successfully from final URL`);
            
            // Process and format the response
            const processedResponse = processDeepSeekSearchResponse(deepseekResponse.data);
            
            return res.status(200).json({
              success: true,
              data: processedResponse,
              request_id: requestId
            });
          } catch (finalAttemptError) {
            // All attempts failed, throw the original error
            console.error(`[${requestId}] All API URL attempts failed`);
            throw firstAttemptError;
          }
        }
      }
    } catch (apiError) {
      console.error(`[${requestId}] DeepSeek API request failed:`, apiError.message);
      
      // Additional error diagnostics
      if (apiError.response) {
        console.error(`[${requestId}] Response status:`, apiError.response.status);
        console.error(`[${requestId}] Response headers:`, JSON.stringify(apiError.response.headers));
        console.error(`[${requestId}] Response data:`, JSON.stringify(apiError.response.data || {}));
      } else {
        console.error(`[${requestId}] No response object available`);
      }
      
      // Provide detailed error information
      let errorDetail = 'API_CALL_FAILED';
      let statusCode = apiError.response?.status || 500;
      
      if (apiError.code === 'ECONNABORTED' || apiError.message.includes('timeout')) {
        errorDetail = 'API_TIMEOUT';
        statusCode = 408;
      }
      
      if (apiError.response?.data?.error) {
        errorDetail = apiError.response.data.error;
      }
      
      // Return error (no mock data fallback)
      return res.status(statusCode).json({
        success: false,
        error: `API request failed: ${apiError.message}`,
        reason: errorDetail,
        request_id: requestId
      });
    }
    
  } catch (error) {
    console.error('DeepSeek API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};

/**
 * Controller for handling product comparison requests
 */
exports.productComparison = async (req, res) => {
  try {
    const { product_ids, comparison_type, include_categories } = req.body;
    
    // Validate request
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: at least two product_ids are required'
      });
    }
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      console.warn('DeepSeek API not configured, returning error');
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key and endpoint.'
      });
    }
    
    console.log(`Making comparison request to DeepSeek API for products:`, product_ids);
    
    // Format request for DeepSeek API
    const deepseekRequest = {
      product_ids,
      comparison_type: comparison_type || 'detailed',
      include_categories: include_categories || ['design', 'performance', 'features', 'value'],
      include_conclusion: true
    };
    
    // Add request ID for tracking
    const requestId = `req_comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Debug the API key for troubleshooting
    console.log(`[${requestId}] API key length: ${deepseekApiKey ? deepseekApiKey.length : 0}`);
    console.log(`[${requestId}] API endpoint: ${deepseekApiEndpoint}`);
    
    // Clean the API key to ensure it doesn't contain invalid characters
    const sanitizedApiKey = deepseekApiKey ? deepseekApiKey.trim().replace(/\r?\n|\r/g, '') : '';
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sanitizedApiKey}`,
      'X-Timestamp': timestamp,
      'Accept': 'application/json'
    };
    
    // Make the actual request to DeepSeek API
    try {
      console.log(`[${requestId}] Sending comparison request to DeepSeek API...`);
      
      // Additional diagnostic logging
      if (config.nodeEnv !== 'production') {
        console.log(`[${requestId}] Request headers:`, JSON.stringify({
          ...headers,
          'Authorization': headers.Authorization ? 'Bearer [REDACTED]' : undefined
        }));
        console.log(`[${requestId}] Request body:`, JSON.stringify(deepseekRequest));
      }
      
      // Extract the base URL correctly - ensure it doesn't end with a slash
      const baseUrl = deepseekApiEndpoint.endsWith('/') 
        ? deepseekApiEndpoint.slice(0, -1) 
        : deepseekApiEndpoint;
      
      // Construct the full API URL - try direct path first
      const apiUrl = `${baseUrl}/product/compare`;
      console.log(`[${requestId}] Trying API URL: ${apiUrl}`);
      
      try {
        const deepseekResponse = await axios.post(
          apiUrl,
          deepseekRequest,
          { 
            headers,
            timeout: 40000  // 40 second timeout for comparisons (they take longer)
          }
        );
        
        console.log(`[${requestId}] DeepSeek API comparison response received successfully`);
        
        // Process the response
        const processedResponse = processDeepSeekComparisonResponse(deepseekResponse.data);
        
        return res.status(200).json({
          success: true,
          data: processedResponse,
          request_id: requestId
        });
      } catch (firstAttemptError) {
        // If first attempt fails, try with v1 prefix
        const v1ApiUrl = `${baseUrl}/v1/product/compare`;
        console.log(`[${requestId}] First attempt failed with ${firstAttemptError.message}, trying alternate URL: ${v1ApiUrl}`);
        
        try {
          const deepseekResponse = await axios.post(
            v1ApiUrl,
            deepseekRequest,
            { 
              headers,
              timeout: 40000  // 40 second timeout for comparisons
            }
          );
          
          console.log(`[${requestId}] DeepSeek API comparison response received successfully from alternate URL`);
          
          // Process the response
          const processedResponse = processDeepSeekComparisonResponse(deepseekResponse.data);
          
          return res.status(200).json({
            success: true,
            data: processedResponse,
            request_id: requestId
          });
        } catch (secondAttemptError) {
          // If both attempts fail, try with api prefix
          const apiPrefixUrl = `${baseUrl}/api/product/compare`;
          console.log(`[${requestId}] Second attempt failed with ${secondAttemptError.message}, trying final URL: ${apiPrefixUrl}`);
          
          try {
            const deepseekResponse = await axios.post(
              apiPrefixUrl,
              deepseekRequest,
              { 
                headers,
                timeout: 40000  // 40 second timeout for comparisons
              }
            );
            
            console.log(`[${requestId}] DeepSeek API comparison response received successfully from final URL`);
            
            // Process the response
            const processedResponse = processDeepSeekComparisonResponse(deepseekResponse.data);
            
            return res.status(200).json({
              success: true,
              data: processedResponse,
              request_id: requestId
            });
          } catch (finalAttemptError) {
            // All attempts failed, throw the original error
            console.error(`[${requestId}] All API URL attempts failed for comparison`);
            throw firstAttemptError;
          }
        }
      }
    } catch (apiError) {
      console.error(`[${requestId}] DeepSeek API comparison request failed:`, apiError.message);
      
      // Additional error diagnostics
      if (apiError.response) {
        console.error(`[${requestId}] Response status:`, apiError.response.status);
        console.error(`[${requestId}] Response headers:`, JSON.stringify(apiError.response.headers));
        console.error(`[${requestId}] Response data:`, JSON.stringify(apiError.response.data || {}));
      } else {
        console.error(`[${requestId}] No response object available`);
      }
      
      // Provide detailed error information
      let errorDetail = 'API_CALL_FAILED';
      let statusCode = apiError.response?.status || 500;
      
      if (apiError.code === 'ECONNABORTED' || apiError.message.includes('timeout')) {
        errorDetail = 'API_TIMEOUT';
        statusCode = 408;
      }
      
      if (apiError.response?.data?.error) {
        errorDetail = apiError.response.data.error;
      }
      
      // Return error (no mock data fallback)
      return res.status(statusCode).json({
        success: false,
        error: `API comparison request failed: ${apiError.message}`,
        reason: errorDetail,
        request_id: requestId
      });
    }
  } catch (error) {
    console.error('DeepSeek API Comparison Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your comparison request'
    });
  }
};

/**
 * Process and format the DeepSeek API search response
 */
function processDeepSeekSearchResponse(apiResponse) {
  // Handle empty or invalid response
  if (!apiResponse || !apiResponse.products || !Array.isArray(apiResponse.products)) {
    console.warn('Invalid or empty API response received');
    return {
      results: [],
      query: '',
      total_results: 0,
      filters: {},
      recommendations: []
    };
  }

  try {
    // Extract product data and format for frontend consumption
    const formattedProducts = apiResponse.products.map(product => {
      // Extract and normalize purchasing options
      const purchasingOptions = Array.isArray(product.purchasing_options) 
        ? product.purchasing_options.map(option => ({
            retailer_name: option.retailer_name || 'Unknown Retailer',
            retailer_url: option.retailer_url || '#',
            price: parseFloat(option.price) || 0,
            is_lowest_price: !!option.is_lowest_price,
            is_reputable: !!option.is_reputable
          }))
        : [];

      // Sort options by price (lowest first)
      purchasingOptions.sort((a, b) => a.price - b.price);

      // Format the final product object
      return {
        id: `prod_${Math.random().toString(36).substring(2, 15)}`,
        name: product.product_name || 'Unnamed Product',
        image_url: product.image_url || '/placeholder-product.jpg',
        price: {
          value: parseFloat(product.average_price) || 0,
          currency: product.currency || 'USD',
          formatted: formatPrice(parseFloat(product.average_price) || 0, product.currency || 'USD')
        },
        rating: {
          value: parseFloat(product.star_rating) || 0,
          count: parseInt(product.review_count) || 0
        },
        pros: product.pros || '',
        cons: product.cons || '',
        purchasing_options: purchasingOptions,
        features: product.features || [],
        specifications: product.specifications || {}
      };
    });

    // Build and return the formatted response
    return {
      results: formattedProducts,
      query: apiResponse.query || '',
      total_results: formattedProducts.length,
      filters: apiResponse.filters || {},
      recommendations: apiResponse.recommendations || []
    };
  } catch (error) {
    console.error('Error processing DeepSeek search response:', error);
    return {
      results: [],
      query: apiResponse.query || '',
      total_results: 0,
      filters: {},
      error: 'Failed to process search results'
    };
  }
}

/**
 * Format price with currency symbol
 */
function formatPrice(price, currency = 'USD') {
  if (isNaN(price)) return '';
  
  try {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency 
    }).format(price);
  } catch (error) {
    // Fallback if Intl API fails
    const currencySymbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    
    const symbol = currencySymbols[currency] || '$';
    return `${symbol}${price.toFixed(2)}`;
  }
}

/**
 * Process and format the DeepSeek API comparison response
 */
function processDeepSeekComparisonResponse(apiResponse) {
  // Handle empty or invalid response
  if (!apiResponse || typeof apiResponse !== 'object') {
    console.warn('Invalid or empty API comparison response received');
    return {
      products: [],
      comparisons: [],
      conclusion: ''
    };
  }

  try {
    // Format products information
    const products = Array.isArray(apiResponse.products) 
      ? apiResponse.products.map(product => ({
          id: product.id || `prod_${Math.random().toString(36).substring(2, 15)}`,
          name: product.name || 'Unnamed Product',
          image_url: product.image_url || '/placeholder-product.jpg',
          price: {
            value: parseFloat(product.price?.value) || 0,
            formatted: product.price?.formatted || formatPrice(parseFloat(product.price?.value) || 0)
          },
          rating: {
            value: parseFloat(product.rating?.value) || 0,
            count: parseInt(product.rating?.count) || 0
          }
        }))
      : [];

    // Format comparison categories
    const comparisons = Array.isArray(apiResponse.comparisons) 
      ? apiResponse.comparisons.map(comparison => ({
          category: comparison.category || 'General',
          analysis: comparison.analysis || [],
          winner: comparison.winner || null
        }))
      : [];

    // Return formatted response
    return {
      products,
      comparisons,
      conclusion: apiResponse.conclusion || '',
      recommendation: apiResponse.recommendation || null
    };
  } catch (error) {
    console.error('Error processing DeepSeek comparison response:', error);
    return {
      products: [],
      comparisons: [],
      conclusion: 'Failed to process comparison results',
      error: error.message
    };
  }
}

/**
 * Generate mock search response data (used for testing without API)
 */
function generateMockSearchResponse(query, filters = {}) {
  console.log('Generating mock search response for query:', query);
  
  // Create mock product data
  const mockProducts = [
    {
      id: 'prod_1a2b3c',
      name: `Premium Toaster (${query})`,
      image_url: 'https://example.com/images/toaster.jpg',
      price: {
        value: 49.99,
        currency: 'USD',
        formatted: '$49.99'
      },
      rating: {
        value: 4.7,
        count: 324
      },
      pros: 'Even toasting distribution. Durable stainless steel construction. Multiple shade settings. Wide slots accommodate bagels.',
      cons: 'Slightly higher price point than competitors. No digital display.',
      purchasing_options: [
        {
          retailer_name: 'Amazon',
          retailer_url: 'https://amazon.com/example-toaster',
          price: 49.99,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: 'Walmart',
          retailer_url: 'https://walmart.com/example-toaster',
          price: 47.88,
          is_lowest_price: true,
          is_reputable: true
        }
      ]
    },
    {
      id: 'prod_4d5e6f',
      name: `Deluxe Blender (${query})`,
      image_url: 'https://example.com/images/blender.jpg',
      price: {
        value: 89.95,
        currency: 'USD',
        formatted: '$89.95'
      },
      rating: {
        value: 4.5,
        count: 189
      },
      pros: 'Powerful 1000W motor. Multiple speed settings. Pulse function. Dishwasher-safe parts.',
      cons: 'Loud at highest speeds. Bulky to store.',
      purchasing_options: [
        {
          retailer_name: 'Target',
          retailer_url: 'https://target.com/example-blender',
          price: 89.95,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: 'Best Buy',
          retailer_url: 'https://bestbuy.com/example-blender',
          price: 84.99,
          is_lowest_price: true,
          is_reputable: true
        }
      ]
    }
  ];

  // Add more mock products based on filters
  if (filters.price_range === 'premium' || filters.price_range === 'high') {
    mockProducts.push({
      id: 'prod_7g8h9i',
      name: `Luxury Coffee Maker (${query})`,
      image_url: 'https://example.com/images/coffee-maker.jpg',
      price: {
        value: 199.99,
        currency: 'USD',
        formatted: '$199.99'
      },
      rating: {
        value: 4.9,
        count: 412
      },
      pros: 'Temperature control. Programmable timer. Built-in grinder. Thermal carafe.',
      cons: 'Expensive compared to basic models. Complex setup process.',
      purchasing_options: [
        {
          retailer_name: 'Bed Bath & Beyond',
          retailer_url: 'https://bedbathbeyond.com/example-coffee-maker',
          price: 199.99,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: 'Crate & Barrel',
          retailer_url: 'https://crateandbarrel.com/example-coffee-maker',
          price: 189.95,
          is_lowest_price: true,
          is_reputable: true
        }
      ]
    });
  }

  // Return formatted mock response
  return {
    results: mockProducts,
    query: query,
    total_results: mockProducts.length,
    filters: filters,
    recommendations: [
      'Consider checking customer reviews for reliability statistics',
      'Look for products with at least 3-year warranties',
      'Energy-efficient models may cost more upfront but save money long-term'
    ]
  };
}

/**
 * Generate mock comparison response (used for testing without API)
 */
function generateMockComparisonResponse(productIds) {
  console.log('Generating mock comparison response for products:', productIds);
  
  // Create mock product data
  const mockProducts = [
    {
      id: productIds[0] || 'prod_1a2b3c',
      name: 'Premium Toaster X5000',
      image_url: 'https://example.com/images/toaster-x5000.jpg',
      price: {
        value: 49.99,
        formatted: '$49.99'
      },
      rating: {
        value: 4.7,
        count: 324
      }
    },
    {
      id: productIds[1] || 'prod_4d5e6f',
      name: 'Ultimate Toaster Elite',
      image_url: 'https://example.com/images/toaster-elite.jpg',
      price: {
        value: 64.95,
        formatted: '$64.95'
      },
      rating: {
        value: 4.5,
        count: 189
      }
    }
  ];

  // Add a third product if requested
  if (productIds.length > 2) {
    mockProducts.push({
      id: productIds[2] || 'prod_7g8h9i',
      name: 'Value Toaster Pro',
      image_url: 'https://example.com/images/toaster-pro.jpg',
      price: {
        value: 34.99,
        formatted: '$34.99'
      },
      rating: {
        value: 4.2,
        count: 412
      }
    });
  }

  // Create mock comparison categories
  const mockComparisons = [
    {
      category: 'Design',
      analysis: [
        `The ${mockProducts[0].name} features a sleek stainless steel design with a modern LCD display. It's slightly bulkier than the ${mockProducts[1].name}.`,
        `The ${mockProducts[1].name} has a more compact design with a retro aesthetic and manual controls. It takes up less counter space.`
      ],
      winner: mockProducts[1].id
    },
    {
      category: 'Performance',
      analysis: [
        `The ${mockProducts[0].name} has six shade settings and special modes for bagels and frozen items. Toasting is even and consistent.`,
        `The ${mockProducts[1].name} has four shade settings but lacks specialty modes. It toasts slightly faster but with less consistency at the edges.`
      ],
      winner: mockProducts[0].id
    },
    {
      category: 'Value',
      analysis: [
        `The ${mockProducts[0].name} offers good value with a 3-year warranty and durable construction despite its higher price point.`,
        `The ${mockProducts[1].name} is more expensive but includes premium features like a removable crumb tray and auto-lift functionality.`
      ],
      winner: mockProducts[0].id
    }
  ];

  // Return formatted mock response
  return {
    products: mockProducts,
    comparisons: mockComparisons,
    conclusion: `Overall, the ${mockProducts[0].name} offers better performance and value, while the ${mockProducts[1].name} wins for design. For most users seeking reliable everyday toasting, the ${mockProducts[0].name} is recommended.`,
    recommendation: mockProducts[0].id
  };
}

module.exports = {
  productSearch: exports.productSearch,
  productComparison: exports.productComparison,
  processDeepSeekSearchResponse,
  processDeepSeekComparisonResponse,
  generateMockSearchResponse,
  generateMockComparisonResponse,
  formatPrice
}; 