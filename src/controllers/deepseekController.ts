import { Request, Response } from 'express';
import config from '../config/config';
import axios from 'axios';
import logger from '../utils/logger';
import { 
  makeDeepSeekRequest, 
  DeepSeekRequestPayload, 
  DeepSeekResponse 
} from '../utils/api-request-util';

/**
 * Controller for handling DeepSeek AI product search
 */
const productSearch = async (req: Request, res: Response) => {
  // Add request ID for tracing the request through logs
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();
  
  logger.info(`[${requestId}] ===== START: Product Search Request =====`);
  logger.info(`[${requestId}] Request body:`, {
    query: req.body.query,
    context: req.body.context,
    filters: req.body.filters,
    // Exclude potentially large or sensitive data
    preferences: req.body.preferences ? 'present' : 'not present'
  });

  try {
    const { query, context, filters, preferences } = req.body;
    
    // Validate request
    if (!query) {
      logger.warn(`[${requestId}] Missing required parameter: query`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request: query is required'
      });
    }
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    // Add detailed logging for debugging
    logger.info(`[${requestId}] DeepSeek API configuration status:`, {
      apiEndpointConfigured: !!deepseekApiEndpoint,
      apiEndpoint: deepseekApiEndpoint,
      apiKeyConfigured: !!deepseekApiKey,
      apiKeyLength: deepseekApiKey ? deepseekApiKey.length : 0,
      apiKeyMasked: deepseekApiKey ? `${deepseekApiKey.substring(0, 3)}...${deepseekApiKey.substring(deepseekApiKey.length - 3)}` : 'None'
    });
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      const reason = !deepseekApiKey ? 'API_KEY_MISSING' : 'API_ENDPOINT_MISSING';
      logger.warn(`[${requestId}] DeepSeek API not configured, returning error. Reason: ${reason}`);
      logger.info(`[${requestId}] ===== END: Product Search Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key and endpoint.',
        reason: reason,
        request_id: requestId
      });
    }
    
    // Format request for DeepSeek API with enhanced shopping assistant prompt
    const promptTemplate = `You are an expert Shopping Research Assistant called Lucid Search. Analyze and return 6 optimal products for: [USER_QUERY_HERE]. Follow these steps:

1. Conduct comprehensive research across:
   - Professional review websites
   - Verified customer reviews
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
    
    // Create DeepSeek API request payload
    const deepseekRequest: DeepSeekRequestPayload = {
      query,
      prompt: enhancedPrompt,
      temperature: 0.3,
      max_tokens: 4000,
      context: context || { search_type: 'product' },
      filters: filters || {},
      preferences: preferences || { include_pros_cons: true }
    };
    
    // Log request details (omitting the full prompt for brevity)
    logger.debug(`[${requestId}] Request parameters:`, {
      query: deepseekRequest.query,
      temperature: deepseekRequest.temperature,
      max_tokens: deepseekRequest.max_tokens,
      context: deepseekRequest.context,
      filters: deepseekRequest.filters,
      // Omit full prompt as it's large
      prompt_length: enhancedPrompt.length,
    });
    
    // Make request to DeepSeek API using our utility function
    logger.info(`[${requestId}] Making request to DeepSeek API for product search`);
    
    try {
      // Set a timeout for the overall request
      const timeoutPromise = new Promise<DeepSeekResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout after 60 seconds'));
        }, 60000);
      });
      
      // Race between the actual API call and the timeout
      const apiResponse = await Promise.race([
        makeDeepSeekRequest('product/search', deepseekRequest, requestId),
        timeoutPromise
      ]);
      
      // Check if we got a successful response
      if (!apiResponse.success) {
        logger.error(`[${requestId}] DeepSeek API request failed: ${apiResponse.error}`);
        logger.info(`[${requestId}] ===== END: Product Search Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
        
        return res.status(apiResponse.status || 500).json({
          success: false,
          error: apiResponse.error || 'API request failed',
          request_id: requestId
        });
      }
      
      // Process the API response
      logger.info(`[${requestId}] Processing DeepSeek API response`);
      const processedResponse = processDeepSeekSearchResponse(apiResponse.data);
      
      // Log completion and return the processed response
      logger.info(`[${requestId}] ===== END: Product Search Request (SUCCESS) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: processedResponse,
        request_id: requestId
      });
    } catch (error: any) {
      logger.error(`[${requestId}] Error during DeepSeek API request: ${error.message}`);
      
      // Check if it's a timeout error
      if (error.message.includes('timeout')) {
        logger.error(`[${requestId}] Request timed out`);
        return res.status(504).json({
          success: false,
          error: 'DeepSeek API request timed out',
          request_id: requestId
        });
      }
      
      // For other errors
      logger.info(`[${requestId}] ===== END: Product Search Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(500).json({
        success: false,
        error: `Error making API request: ${error.message}`,
        request_id: requestId
      });
    }
  } catch (error: any) {
    // Handle any unexpected errors in the controller
    logger.error(`[${requestId}] Unexpected error in productSearch controller: ${error.message}`);
    logger.error(`[${requestId}] Stack trace: ${error.stack}`);
    logger.info(`[${requestId}] ===== END: Product Search Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing product search request',
      message: error.message,
      request_id: requestId
    });
  }
};

/**
 * Controller for handling DeepSeek AI product comparison
 */
const productComparison = async (req: Request, res: Response) => {
  // Add request ID for tracing the request through logs
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();
  
  logger.info(`[${requestId}] ===== START: Product Comparison Request =====`);
  
  try {
    const { product_ids, comparison_type } = req.body;
    
    // Validate request
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length < 2) {
      logger.warn(`[${requestId}] Invalid product_ids: ${JSON.stringify(product_ids)}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request: at least two product_ids are required in an array'
      });
    }
    
    // Log the product IDs being compared
    logger.info(`[${requestId}] Comparing products:`, product_ids);
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      const reason = !deepseekApiKey ? 'API_KEY_MISSING' : 'API_ENDPOINT_MISSING';
      logger.warn(`[${requestId}] DeepSeek API not configured, returning error. Reason: ${reason}`);
      logger.info(`[${requestId}] ===== END: Product Comparison Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(503).json({
        success: false,
        error: 'API service is not configured. Please set up the API key and endpoint.',
        reason: reason,
        request_id: requestId
      });
    }
    
    // Format request for DeepSeek API with enhanced comparison prompt
    const promptTemplate = `You are an expert Shopping Research Assistant named Lucid Compare. You're analyzing ${product_ids.length} products with IDs: ${product_ids.join(', ')}. Conduct a detailed comparison using these steps:

1. Create a comprehensive, detailed comparison across all important aspects (features, performance, value, etc.)
2. Evaluate the pros and cons of each product relative to each other
3. Provide an objective final recommendation with clear reasoning

Format the response as JSON with this exact structure:
{
  "products": [
    {
      "id": "product_id_here",
      "name": "Full Product Name",
      "price": {
        "value": 199.99,
        "formatted": "$199.99"
      },
      "rating": {
        "value": 4.5,
        "count": 324
      },
      "summary": "Brief one-sentence product summary"
    }
  ],
  "comparisons": [
    {
      "category": "Feature/Category Name",
      "analysis": [
        "Detailed comparison point 1",
        "Detailed comparison point 2"
      ],
      "winner": "product_id_of_winner_for_this_category"
    }
  ],
  "conclusion": "Final detailed recommendation with reasoning",
  "best_overall": "product_id_of_best_overall"
}

Requirements:
- Include at least 5 comparison categories (design, performance, features, value, etc.)
- Each category should have at least 3 detailed comparison points
- Provide clear reasons for each category winner
- Make the conclusion substantive and helpful for a purchase decision
- Use objective criteria whenever possible`;

    // Create DeepSeek API request payload
    const deepseekRequest: DeepSeekRequestPayload = {
      product_ids: product_ids,
      comparison_type: comparison_type || 'detailed',
      prompt: promptTemplate,
      temperature: 0.2,
      max_tokens: 4000,
      include_categories: ['design', 'performance', 'features', 'value', 'usability'],
      include_conclusion: true
    };
    
    // Make request to DeepSeek API using our utility function
    logger.info(`[${requestId}] Making request to DeepSeek API for product comparison`);
    
    try {
      // Set a timeout for the overall request
      const timeoutPromise = new Promise<DeepSeekResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout after 60 seconds'));
        }, 60000);
      });
      
      // Race between the actual API call and the timeout
      const apiResponse = await Promise.race([
        makeDeepSeekRequest('product/compare', deepseekRequest, requestId),
        timeoutPromise
      ]);
      
      // Check if we got a successful response
      if (!apiResponse.success) {
        logger.error(`[${requestId}] DeepSeek API request failed: ${apiResponse.error}`);
        logger.info(`[${requestId}] ===== END: Product Comparison Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
        
        return res.status(apiResponse.status || 500).json({
          success: false,
          error: apiResponse.error || 'API request failed',
          request_id: requestId
        });
      }
      
      // Process the API response
      logger.info(`[${requestId}] Processing DeepSeek API comparison response`);
      const processedResponse = processDeepSeekComparisonResponse(apiResponse.data);
      
      // Log completion and return the processed response
      logger.info(`[${requestId}] ===== END: Product Comparison Request (SUCCESS) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: processedResponse,
        request_id: requestId
      });
    } catch (error: any) {
      logger.error(`[${requestId}] Error during DeepSeek API comparison request: ${error.message}`);
      
      // Check if it's a timeout error
      if (error.message.includes('timeout')) {
        logger.error(`[${requestId}] Comparison request timed out`);
        return res.status(504).json({
          success: false,
          error: 'DeepSeek API comparison request timed out',
          request_id: requestId
        });
      }
      
      // For other errors
      logger.info(`[${requestId}] ===== END: Product Comparison Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(500).json({
        success: false,
        error: `Error making API comparison request: ${error.message}`,
        request_id: requestId
      });
    }
  } catch (error: any) {
    // Handle any unexpected errors in the controller
    logger.error(`[${requestId}] Unexpected error in productComparison controller: ${error.message}`);
    logger.error(`[${requestId}] Stack trace: ${error.stack}`);
    logger.info(`[${requestId}] ===== END: Product Comparison Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing product comparison request',
      message: error.message,
      request_id: requestId
    });
  }
};

// Utility functions for processing responses and generating mock data

/**
 * Process the DeepSeek API search response into a standardized format
 * @param apiResponse - Raw API response from DeepSeek
 * @returns Processed response with standardized structure
 */
function processDeepSeekSearchResponse(apiResponse: any): any {
  // Handle empty or invalid response
  if (!apiResponse) {
    return {
      results: [],
      query: '',
      filters: {},
      total_results: 0
    };
  }

  // Initialize return structure
  const processed = {
    results: [],
    query: apiResponse.query || '',
    filters: apiResponse.filters || {},
    total_results: 0
  };

  try {
    // Normalize response structure - DeepSeek API might return data in different formats
    const products = apiResponse.products || apiResponse.results || [];
    processed.total_results = products.length;

    // Process each product
    processed.results = products.map((product: any, index: number) => {
      // Handle missing product name
      const name = product.product_name || product.name || `Unnamed Product`;
      
      // Process price to ensure it's a number
      let price = 0;
      try {
        if (product.average_price) {
          // Handle both string and number formats
          price = typeof product.average_price === 'string' 
            ? parseFloat(product.average_price.replace(/[^0-9.]/g, '')) 
            : parseFloat(product.average_price);
        } else if (product.price) {
          // Handle both direct price or price object
          if (typeof product.price === 'object' && product.price.value) {
            price = parseFloat(product.price.value);
          } else {
            price = typeof product.price === 'string' 
              ? parseFloat(product.price.replace(/[^0-9.]/g, '')) 
              : parseFloat(product.price);
          }
        }
      } catch (e) {
        logger.warn(`Error parsing price for product ${name}: ${e}`);
        price = 0;
      }

      // Process rating
      let ratingValue = 0;
      let ratingCount = 0;
      try {
        if (product.star_rating) {
          ratingValue = typeof product.star_rating === 'string' 
            ? parseFloat(product.star_rating) 
            : product.star_rating;
        } else if (product.rating) {
          // Handle both direct rating or rating object
          if (typeof product.rating === 'object') {
            ratingValue = product.rating.value || 0;
            ratingCount = product.rating.count || 0;
          } else {
            ratingValue = product.rating;
          }
        }
        
        // Parse review count if available
        if (product.review_count) {
          ratingCount = typeof product.review_count === 'string' 
            ? parseInt(product.review_count.replace(/[^0-9]/g, ''), 10) 
            : product.review_count;
        }
      } catch (e) {
        logger.warn(`Error parsing rating for product ${name}: ${e}`);
      }

      // Process purchasing options
      const purchasingOptions = (product.purchasing_options || []).map((option: any) => {
        let optionPrice = 0;
        try {
          optionPrice = typeof option.price === 'string' 
            ? parseFloat(option.price.replace(/[^0-9.]/g, '')) 
            : parseFloat(option.price);
        } catch {
          optionPrice = 0;
        }

        return {
          retailer: option.retailer_name || option.retailer || 'Unknown Retailer',
          url: option.retailer_url || option.url || '',
          price: {
            value: optionPrice,
            formatted: formatPrice(optionPrice, 'USD')
          },
          is_lowest_price: !!option.is_lowest_price,
          is_reputable: !!option.is_reputable
        };
      });

      // Construct standardized product object
      return {
        id: product.id || `product_${index}`,
        name: name,
        image: product.image_url || product.image || '',
        price: {
          value: price,
          formatted: formatPrice(price, 'USD')
        },
        rating: {
          value: ratingValue,
          count: ratingCount,
          formatted: `${ratingValue.toFixed(1)} (${ratingCount} reviews)`
        },
        pros: product.pros || '',
        cons: product.cons || '',
        description: product.description || '',
        purchasing_options: purchasingOptions,
        category: product.category || ''
      };
    });

    return processed;
  } catch (error) {
    logger.error('Error processing DeepSeek search response:', error);
    
    // Return partial results or empty results in case of error
    return {
      results: processed.results.length > 0 ? processed.results : [],
      query: processed.query,
      filters: processed.filters,
      total_results: processed.results.length,
      _processing_error: `${error}`
    };
  }
}

/**
 * Format a price with currency symbol
 * @param price - Numeric price value
 * @param currency - Currency code (USD, EUR, etc.)
 * @returns Formatted price string
 */
function formatPrice(price: number, currency: string = 'USD'): string {
  if (isNaN(price)) return '';
  
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'INR': '₹'
  };

  const symbol = currencySymbols[currency] || currency;
  
  // Format based on currency
  switch (currency) {
    case 'JPY':
      // No decimal places for Yen
      return `${symbol}${Math.round(price)}`;
    case 'EUR':
      // European format using comma as decimal separator
      return `${symbol}${price.toFixed(2).replace('.', ',')}`;
    default:
      return `${symbol}${price.toFixed(2)}`;
  }
}

/**
 * Process the DeepSeek API comparison response into a standardized format
 * @param apiResponse - Raw API response from DeepSeek
 * @returns Processed comparison response with standardized structure
 */
function processDeepSeekComparisonResponse(apiResponse: any): any {
  // Handle empty or invalid response
  if (!apiResponse) {
    return {
      products: [],
      comparisons: [],
      conclusion: '',
      best_overall: null
    };
  }

  try {
    // Initialize the processed response structure
    const processed = {
      products: [],
      comparisons: [],
      conclusion: apiResponse.conclusion || '',
      best_overall: apiResponse.best_overall || null
    };

    // Process products
    if (Array.isArray(apiResponse.products)) {
      processed.products = apiResponse.products.map((product: any) => {
        // Get the price value, handling different formats
        let priceValue = 0;
        if (product.price) {
          if (typeof product.price === 'object' && product.price.value) {
            priceValue = parseFloat(product.price.value);
          } else if (typeof product.price === 'string') {
            priceValue = parseFloat(product.price.replace(/[^0-9.]/g, ''));
          } else if (typeof product.price === 'number') {
            priceValue = product.price;
          }
        }

        // Get rating value and count, handling different formats
        let ratingValue = 0;
        let ratingCount = 0;
        if (product.rating) {
          if (typeof product.rating === 'object') {
            ratingValue = product.rating.value || 0;
            ratingCount = product.rating.count || 0;
          } else if (typeof product.rating === 'number') {
            ratingValue = product.rating;
          }
        }

        // Return formatted product
        return {
          id: product.id || '',
          name: product.name || 'Unnamed Product',
          price: {
            value: priceValue,
            formatted: product.price?.formatted || formatPrice(priceValue)
          },
          rating: {
            value: ratingValue,
            count: ratingCount,
            formatted: `${ratingValue.toFixed(1)}${ratingCount ? ` (${ratingCount} reviews)` : ''}`
          },
          summary: product.summary || ''
        };
      });
    }

    // Process comparisons
    if (Array.isArray(apiResponse.comparisons)) {
      processed.comparisons = apiResponse.comparisons.map((comparison: any) => {
        return {
          category: comparison.category || 'Comparison',
          analysis: Array.isArray(comparison.analysis) ? comparison.analysis : [comparison.analysis || ''],
          winner: comparison.winner || null
        };
      });
    }

    return processed;
  } catch (error) {
    logger.error('Error processing DeepSeek comparison response:', error);
    
    // Return minimal response in case of error
    return {
      products: Array.isArray(apiResponse.products) ? apiResponse.products : [],
      comparisons: Array.isArray(apiResponse.comparisons) ? apiResponse.comparisons : [],
      conclusion: apiResponse.conclusion || '',
      best_overall: apiResponse.best_overall || null,
      _processing_error: `${error}`
    };
  }
}

/**
 * Generate a mock search response for testing or when API is unavailable
 * @param query The search query
 * @param filters Optional filter parameters
 * @returns Mock search results in the same format as the API response
 */
function generateMockSearchResponse(query: string, filters: any = {}): any {
  // Generate a deterministic but seemingly random ID from the query
  const getIdFromString = (str: string, index: number): string => {
    const hash = str.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0) + index;
    return `prod_${Math.abs(hash).toString(16).substring(0, 8)}`;
  };
  
  // Create some random price between min and max
  const randomPrice = (min: number, max: number): number => {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  };
  
  // Create a random rating between 3 and 5 with one decimal
  const randomRating = (): number => {
    return Math.round((3 + Math.random() * 2) * 10) / 10;
  };
  
  // Create a random number of reviews
  const randomReviews = (): number => {
    return Math.floor(20 + Math.random() * 980);
  };
  
  // Sample product data based on query
  const queryWords = query.toLowerCase().replace(/[^\w\s]/g, '').split(' ');
  
  // Product names based on common query categories
  const productTemplates = [
    { prefix: "Premium", suffix: "Pro" },
    { prefix: "Ultra", suffix: "Max" },
    { prefix: "Smart", suffix: "Elite" },
    { prefix: "Advanced", suffix: "Plus" },
    { prefix: "Budget", suffix: "Value" },
    { prefix: "Essential", suffix: "Basic" }
  ];
  
  // Generate 5-8 mock products
  const productCount = Math.floor(5 + Math.random() * 3);
  const mockProducts = [];
  
  for (let i = 0; i < productCount; i++) {
    const template = productTemplates[i % productTemplates.length];
    const nameBase = queryWords[0]?.charAt(0).toUpperCase() + queryWords[0]?.slice(1) || "Product";
    const secondWord = queryWords[1]?.charAt(0).toUpperCase() + queryWords[1]?.slice(1) || "";
    
    // Create product name
    const productName = `${template.prefix} ${nameBase} ${secondWord} ${template.suffix}`.trim();
    
    // Create unique ID
    const productId = getIdFromString(productName, i);
    
    // Generate price based on product "tier"
    let basePrice;
    if (template.prefix === "Premium" || template.prefix === "Ultra") {
      basePrice = randomPrice(399, 999);
    } else if (template.prefix === "Smart" || template.prefix === "Advanced") {
      basePrice = randomPrice(199, 499);
    } else {
      basePrice = randomPrice(49, 249);
    }
    
    // Generate rating (premium products get slightly better ratings)
    const rating = template.prefix === "Premium" ? 
      Math.min(5, randomRating() + 0.3) : 
      (template.prefix === "Budget" ? Math.max(3, randomRating() - 0.3) : randomRating());
    
    // Generate review count (popular products get more reviews)
    const reviewCount = template.prefix === "Premium" || template.prefix === "Ultra" ? 
      randomReviews() * 2 : randomReviews();
    
    // Create mock product
    mockProducts.push({
      id: productId,
      name: productName,
      image: `https://placehold.co/600x400?text=${encodeURIComponent(productName)}`,
      price: {
        value: basePrice,
        formatted: formatPrice(basePrice)
      },
      rating: {
        value: rating,
        count: reviewCount,
        formatted: `${rating.toFixed(1)} (${reviewCount} reviews)`
      },
      pros: `This ${nameBase.toLowerCase()} offers excellent performance compared to competitors. It features high-quality materials and construction, making it durable for daily use. ${template.prefix === "Premium" ? "Premium components ensure reliability." : ""}`,
      cons: `${template.prefix === "Budget" ? `As a budget option, this ${nameBase.toLowerCase()} lacks some advanced features found in premium models.` : `Some users report minor issues with the ${nameBase.toLowerCase()} after extended use.`} The customer service experience could be improved.`,
      description: `The ${productName} is a ${template.prefix.toLowerCase()} ${nameBase.toLowerCase()} designed for ${filters.purpose || "everyday use"}. It combines performance with ${template.prefix === "Premium" ? "exceptional" : "good"} value.`,
      purchasing_options: [
        {
          retailer: "SuperStore",
          url: "https://example.com/product",
          price: {
            value: basePrice,
            formatted: formatPrice(basePrice)
          },
          is_lowest_price: true,
          is_reputable: true
        },
        {
          retailer: "MegaMart",
          url: "https://example.com/product",
          price: {
            value: basePrice * 1.05,
            formatted: formatPrice(basePrice * 1.05)
          },
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer: "BudgetBuy",
          url: "https://example.com/product",
          price: {
            value: basePrice * 1.02,
            formatted: formatPrice(basePrice * 1.02)
          },
          is_lowest_price: false,
          is_reputable: false
        },
        {
          retailer: "ValueVendor",
          url: "https://example.com/product",
          price: {
            value: basePrice * 0.98,
            formatted: formatPrice(basePrice * 0.98)
          },
          is_lowest_price: true,
          is_reputable: false
        }
      ],
      category: queryWords[0] || "General"
    });
  }
  
  // Return with standardized format
  return {
    results: mockProducts,
    query: query,
    filters: filters,
    total_results: mockProducts.length,
    is_mock: true
  };
}

/**
 * Generate a mock comparison response for testing or when API is unavailable
 * @param productIds Array of product IDs to compare
 * @returns Mock comparison in the same format as the API response
 */
function generateMockComparisonResponse(productIds: string[]): any {
  if (!productIds || productIds.length < 2) {
    return {
      products: [],
      comparisons: [],
      conclusion: "Insufficient products for comparison",
      best_overall: null,
      is_mock: true
    };
  }
  
  // Create mock product data
  const mockProducts = productIds.map((id, index) => {
    // Extract any meaningful info from ID if possible
    const idBase = id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
    const isPremium = idBase.includes("prem") || idBase.includes("pro") || index === 0;
    const isBudget = idBase.includes("budg") || idBase.includes("basic") || index === productIds.length - 1;
    
    // Generate price based on "tier"
    let price;
    if (isPremium) {
      price = 499 + (Math.random() * 300);
    } else if (isBudget) {
      price = 99 + (Math.random() * 150);
    } else {
      price = 249 + (Math.random() * 200);
    }
    price = Math.round(price * 100) / 100;
    
    // Generate rating
    let rating;
    if (isPremium) {
      rating = 4.3 + (Math.random() * 0.7);
    } else if (isBudget) {
      rating = 3.5 + (Math.random() * 0.8);
    } else {
      rating = 3.8 + (Math.random() * 1.0);
    }
    rating = Math.round(rating * 10) / 10;
    
    // Generate review count
    const reviewCount = isPremium ? 500 + Math.floor(Math.random() * 1500) : 
                      isBudget ? 100 + Math.floor(Math.random() * 500) :
                      250 + Math.floor(Math.random() * 750);
    
    return {
      id: id,
      name: isPremium ? `Premium Pro Model ${idBase.substring(0, 3).toUpperCase()}` :
            isBudget ? `Basic Value Model ${idBase.substring(0, 3).toUpperCase()}` :
            `Standard Model ${idBase.substring(0, 3).toUpperCase()}`,
      price: {
        value: price,
        formatted: formatPrice(price)
      },
      rating: {
        value: rating,
        count: reviewCount,
        formatted: `${rating.toFixed(1)} (${reviewCount} reviews)`
      },
      summary: isPremium ? "High-end model with premium features and performance" :
               isBudget ? "Budget-friendly option with basic functionality" :
               "Mid-range model with good balance of features and value"
    };
  });
  
  // Create comparison categories
  const comparisonCategories = ["Design", "Performance", "Features", "Value", "Usability"];
  const mockComparisons = comparisonCategories.map(category => {
    // Determine a "winner" - biased slightly toward premium products for most categories except "Value"
    let winnerIndex;
    if (category === "Value") {
      // For value, prefer budget or mid-range
      winnerIndex = Math.floor(Math.random() * (productIds.length - 1)) + 1;
    } else if (category === "Performance" || category === "Features") {
      // For performance and features, prefer premium
      winnerIndex = Math.random() < 0.7 ? 0 : Math.floor(Math.random() * (productIds.length - 1)) + 1;
    } else {
      // For other categories, more random but still slight premium bias
      winnerIndex = Math.floor(Math.random() * productIds.length);
    }
    
    // Generate analysis points
    const analysisPoints = [
      `The ${mockProducts[winnerIndex].name} excels in ${category.toLowerCase()} compared to other models.`,
      `When considering ${category.toLowerCase()}, there are notable differences between the models.`,
      `${mockProducts[0].name} offers ${mockProducts[0].id === productIds[winnerIndex] ? "the best" : "good"} ${category.toLowerCase()} characteristics.`,
      `${mockProducts[productIds.length-1].name} ${mockProducts[productIds.length-1].id === productIds[winnerIndex] ? "surprisingly outperforms" : "underperforms"} in this category.`
    ];
    
    return {
      category: category,
      analysis: analysisPoints,
      winner: productIds[winnerIndex]
    };
  });
  
  // Determine overall best product (weighted toward premium but not guaranteed)
  const randomFactor = Math.random();
  let bestOverallIndex;
  
  if (randomFactor < 0.5) {
    // 50% chance of premium being best
    bestOverallIndex = 0;
  } else if (randomFactor < 0.8) {
    // 30% chance of mid-range being best
    bestOverallIndex = Math.floor(productIds.length / 2);
  } else {
    // 20% chance of another model being best
    bestOverallIndex = Math.floor(Math.random() * productIds.length);
  }
  
  const bestOverallId = productIds[bestOverallIndex];
  const bestOverallName = mockProducts[bestOverallIndex].name;
  
  // Generate conclusion
  const conclusion = `After comprehensive analysis, the ${bestOverallName} is the recommended choice for most users. It offers the best overall balance of design, performance, features, and value. ${bestOverallIndex === 0 ? "While it comes at a premium price point, the quality and features justify the investment." : bestOverallIndex === productIds.length - 1 ? "It provides excellent value for budget-conscious consumers without sacrificing essential functionality." : "It strikes an excellent balance between premium features and reasonable pricing."}`;
  
  return {
    products: mockProducts,
    comparisons: mockComparisons,
    conclusion: conclusion,
    best_overall: bestOverallId,
    is_mock: true
  };
}

// Export all controller functions and utilities
export {
  productSearch,
  productComparison,
  processDeepSeekSearchResponse,
  processDeepSeekComparisonResponse,
  formatPrice,
  generateMockSearchResponse,
  generateMockComparisonResponse
}; 