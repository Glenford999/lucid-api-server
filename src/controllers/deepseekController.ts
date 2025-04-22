import { Request, Response } from 'express';
import config from '../config/config';
import axios from 'axios';

/**
 * Controller for handling DeepSeek AI product search
 */
export const productSearch = async (req: Request, res: Response) => {
  // Add request ID for tracing the request through logs
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] ===== START: Product Search Request =====`);
  console.log(`[${requestId}] Request body: ${JSON.stringify({
    query: req.body.query,
    context: req.body.context,
    filters: req.body.filters,
    // Exclude potentially large or sensitive data
    preferences: req.body.preferences ? 'present' : 'not present'
  })}`);

  try {
    const { query, context, filters, preferences } = req.body;
    
    // Validate request
    if (!query) {
      console.log(`[${requestId}] Missing required parameter: query`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request: query is required'
      });
    }
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    // Add detailed logging for debugging
    console.log(`[${requestId}] DeepSeek API configuration status:`);
    console.log(`[${requestId}] API Endpoint configured: ${!!deepseekApiEndpoint} (${deepseekApiEndpoint})`);
    console.log(`[${requestId}] API Key configured: ${!!deepseekApiKey} (length: ${deepseekApiKey ? deepseekApiKey.length : 0})`);
    console.log(`[${requestId}] API Key masked: ${deepseekApiKey ? deepseekApiKey.substring(0, 3) + '...' + deepseekApiKey.substring(deepseekApiKey.length - 3) : 'None'}`);
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      console.warn(`[${requestId}] DeepSeek API not configured, returning mock data`);
      const reason = !deepseekApiKey ? 'API_KEY_MISSING' : 'API_ENDPOINT_MISSING';
      console.log(`[${requestId}] Mock data reason: ${reason}`);
      
      const mockResponse = generateMockSearchResponse(query, filters);
      console.log(`[${requestId}] ===== END: Product Search Request (MOCK) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: mockResponse,
        is_mock: true,
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
    
    const deepseekRequest = {
      query,
      prompt: enhancedPrompt,
      temperature: 0.3,
      max_tokens: 4000,
      context: context || { search_type: 'product' },
      filters: filters || {},
      preferences: preferences || { include_pros_cons: true }
    };
    
    // Log request details (omitting the full prompt for brevity)
    console.log(`[${requestId}] Making request to DeepSeek API at ${deepseekApiEndpoint} for query: "${query}"`);
    console.log(`[${requestId}] Request parameters: ${JSON.stringify({
      query: deepseekRequest.query,
      temperature: deepseekRequest.temperature,
      max_tokens: deepseekRequest.max_tokens,
      context: deepseekRequest.context,
      filters: deepseekRequest.filters,
      // Omit full prompt as it's large
      prompt_length: enhancedPrompt.length,
    })}`);
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': deepseekApiKey,
      'X-Timestamp': timestamp
    };
    
    console.log(`[${requestId}] Request headers: ${JSON.stringify({
      'Content-Type': headers['Content-Type'],
      'X-API-Key': '***********', // Don't log actual API key
      'X-Timestamp': headers['X-Timestamp']
    })}`);
    
    // Make the actual request to DeepSeek API
    try {
      console.log(`[${requestId}] Sending API request to ${deepseekApiEndpoint}/v1/product/search...`);
      const apiRequestStartTime = Date.now();
      
      const deepseekResponse = await axios.post(
        `${deepseekApiEndpoint}/v1/product/search`,
        deepseekRequest,
        { headers }
      );
      
      const apiRequestDuration = Date.now() - apiRequestStartTime;
      console.log(`[${requestId}] API request completed in ${apiRequestDuration}ms with status ${deepseekResponse.status}`);
      
      // Log response structure without full content
      console.log(`[${requestId}] Response structure: ${JSON.stringify({
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
        headers: deepseekResponse.headers,
        data_keys: Object.keys(deepseekResponse.data || {}),
        has_products: !!deepseekResponse.data?.products,
        product_count: Array.isArray(deepseekResponse.data?.products) ? deepseekResponse.data.products.length : 'N/A',
        has_results: !!deepseekResponse.data?.results,
        result_count: Array.isArray(deepseekResponse.data?.results) ? deepseekResponse.data.results.length : 'N/A'
      })}`);
      
      // Process and format the response
      console.log(`[${requestId}] Processing response data...`);
      const processedResponse = processDeepSeekSearchResponse(deepseekResponse.data);
      
      console.log(`[${requestId}] Processed response structure: ${JSON.stringify({
        result_count: processedResponse.results ? processedResponse.results.length : 0,
        query: processedResponse.query,
        has_filters: !!processedResponse.filters,
        total_results: processedResponse.total_results
      })}`);
      
      console.log(`[${requestId}] ===== END: Product Search Request (SUCCESS) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: processedResponse,
        request_id: requestId
      });
    } catch (apiError: any) {
      const apiErrorDetails = {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        response_data: apiError.response?.data ? JSON.stringify(apiError.response.data).substring(0, 500) : 'No response data',
        request_url: apiError.config?.url,
        request_method: apiError.config?.method,
        is_timeout: apiError.code === 'ECONNABORTED',
        is_network_error: !apiError.response && !!apiError.request
      };
      
      console.error(`[${requestId}] DeepSeek API request failed:`, JSON.stringify(apiErrorDetails));
      
      // Fall back to mock data if API request fails
      const mockResponse = generateMockSearchResponse(query, filters);
      console.log(`[${requestId}] ===== END: Product Search Request (FALLBACK) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: mockResponse,
        is_fallback: true,
        error_details: {
          message: apiError.message,
          status: apiError.response?.status,
          code: apiError.code
        },
        request_id: requestId
      });
    }
    
  } catch (error: any) {
    console.error(`[${requestId}] DeepSeek API Error:`, error);
    console.log(`[${requestId}] Error stack:`, error.stack);
    console.log(`[${requestId}] ===== END: Product Search Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request',
      request_id: requestId
    });
  }
};

/**
 * Controller for handling DeepSeek AI product comparison
 */
export const productComparison = async (req: Request, res: Response) => {
  // Add request ID for tracing the request through logs
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] ===== START: Product Comparison Request =====`);
  console.log(`[${requestId}] Request body: ${JSON.stringify({
    product_ids: req.body.product_ids,
    comparison_type: req.body.comparison_type,
    include_categories: req.body.include_categories,
    include_conclusion: req.body.include_conclusion
  })}`);
  
  try {
    const { product_ids, comparison_type, include_categories, include_conclusion } = req.body;
    
    // Validate request
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length < 2) {
      console.log(`[${requestId}] Invalid request: insufficient product_ids`);
      return res.status(400).json({
        success: false,
        error: 'Invalid request: at least two product_ids are required',
        request_id: requestId
      });
    }
    
    // Check if DeepSeek API is configured
    const deepseekApiKey = config.deepseekApiKey;
    const deepseekApiEndpoint = config.deepseekApiEndpoint;
    
    // Add detailed logging for debugging
    console.log(`[${requestId}] DeepSeek API configuration status:`);
    console.log(`[${requestId}] API Endpoint configured: ${!!deepseekApiEndpoint} (${deepseekApiEndpoint})`);
    console.log(`[${requestId}] API Key configured: ${!!deepseekApiKey} (length: ${deepseekApiKey ? deepseekApiKey.length : 0})`);
    console.log(`[${requestId}] API Key masked: ${deepseekApiKey ? deepseekApiKey.substring(0, 3) + '...' + deepseekApiKey.substring(deepseekApiKey.length - 3) : 'None'}`);
    
    if (!deepseekApiKey || !deepseekApiEndpoint) {
      console.warn(`[${requestId}] DeepSeek API not configured, returning mock data`);
      const reason = !deepseekApiKey ? 'API_KEY_MISSING' : 'API_ENDPOINT_MISSING';
      console.log(`[${requestId}] Mock data reason: ${reason}`);
      
      const mockResponse = generateMockComparisonResponse(product_ids);
      console.log(`[${requestId}] ===== END: Product Comparison Request (MOCK) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: mockResponse,
        is_mock: true,
        reason: reason,
        request_id: requestId
      });
    }
    
    // Format request for DeepSeek API
    const deepseekRequest = {
      product_ids,
      comparison_type: comparison_type || 'detailed',
      include_categories: include_categories || ['design', 'performance', 'features', 'value'],
      include_conclusion: include_conclusion !== false
    };
    
    // Log request details
    console.log(`[${requestId}] Making comparison request to DeepSeek API for products: ${product_ids.join(', ')}`);
    console.log(`[${requestId}] Request parameters: ${JSON.stringify(deepseekRequest)}`);
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': deepseekApiKey,
      'X-Timestamp': timestamp
    };
    
    console.log(`[${requestId}] Request headers: ${JSON.stringify({
      'Content-Type': headers['Content-Type'],
      'X-API-Key': '***********', // Don't log actual API key
      'X-Timestamp': headers['X-Timestamp']
    })}`);
    
    // Make the actual request to DeepSeek API
    try {
      console.log(`[${requestId}] Sending API request to ${deepseekApiEndpoint}/v1/product/compare...`);
      const apiRequestStartTime = Date.now();
      
      const deepseekResponse = await axios.post(
        `${deepseekApiEndpoint}/v1/product/compare`,
        deepseekRequest,
        { headers }
      );
      
      const apiRequestDuration = Date.now() - apiRequestStartTime;
      console.log(`[${requestId}] API request completed in ${apiRequestDuration}ms with status ${deepseekResponse.status}`);
      
      // Log response structure without full content
      console.log(`[${requestId}] Response structure: ${JSON.stringify({
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
        headers: deepseekResponse.headers,
        data_keys: Object.keys(deepseekResponse.data || {})
      })}`);
      
      // Process and format the response
      console.log(`[${requestId}] Processing response data...`);
      const processedResponse = processDeepSeekComparisonResponse(deepseekResponse.data);
      
      console.log(`[${requestId}] ===== END: Product Comparison Request (SUCCESS) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: processedResponse,
        request_id: requestId
      });
    } catch (apiError: any) {
      const apiErrorDetails = {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        response_data: apiError.response?.data ? JSON.stringify(apiError.response.data).substring(0, 500) : 'No response data',
        request_url: apiError.config?.url,
        request_method: apiError.config?.method,
        is_timeout: apiError.code === 'ECONNABORTED',
        is_network_error: !apiError.response && !!apiError.request
      };
      
      console.error(`[${requestId}] DeepSeek API request failed:`, JSON.stringify(apiErrorDetails));
      
      // Fall back to mock data if API request fails
      const mockResponse = generateMockComparisonResponse(product_ids);
      console.log(`[${requestId}] ===== END: Product Comparison Request (FALLBACK) ===== Duration: ${Date.now() - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: mockResponse,
        is_fallback: true,
        error_details: {
          message: apiError.message,
          status: apiError.response?.status,
          code: apiError.code
        },
        request_id: requestId
      });
    }
    
  } catch (error: any) {
    console.error(`[${requestId}] DeepSeek API Error:`, error);
    console.log(`[${requestId}] Error stack:`, error.stack);
    console.log(`[${requestId}] ===== END: Product Comparison Request (ERROR) ===== Duration: ${Date.now() - startTime}ms`);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request',
      request_id: requestId
    });
  }
};

// Utility functions for processing responses and generating mock data

/**
 * Process and validate a DeepSeek search response
 * @param apiResponse Raw API response from DeepSeek
 * @returns Normalized and validated response data
 */
function processDeepSeekSearchResponse(apiResponse: any): any {
  // Create a unique processor ID for this response processing operation
  const processorId = `proc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${processorId}] Processing DeepSeek search response...`);
  
  try {
    // First, check if the response is valid and log its structure
    if (!apiResponse) {
      console.error(`[${processorId}] Invalid response: empty or null`);
      throw new Error('Invalid response format from DeepSeek API: empty or null response');
    }
    
    if (typeof apiResponse !== 'object') {
      console.error(`[${processorId}] Invalid response: not an object, type=${typeof apiResponse}`);
      throw new Error(`Invalid response format from DeepSeek API: expected object, got ${typeof apiResponse}`);
    }
    
    // Log response keys and structure
    console.log(`[${processorId}] Response keys: ${JSON.stringify(Object.keys(apiResponse))}`);
    
    // If response is an error message
    if (apiResponse.error || apiResponse.errors) {
      const errorMsg = apiResponse.error || 
                      (Array.isArray(apiResponse.errors) ? apiResponse.errors.join(', ') : apiResponse.errors);
      console.error(`[${processorId}] DeepSeek API returned error: ${errorMsg}`);
      throw new Error(`DeepSeek API error: ${errorMsg}`);
    }

    // Check if response is using the new format with "products" key for enhanced prompt
    const hasNewFormat = apiResponse.products && Array.isArray(apiResponse.products);
    console.log(`[${processorId}] Response format: ${hasNewFormat ? 'new (with products array)' : 'original'}`);
    
    // Get results from the appropriate source
    const results = hasNewFormat 
      ? apiResponse.products 
      : Array.isArray(apiResponse.results) 
        ? apiResponse.results 
        : [];

    console.log(`[${processorId}] Result count: ${results.length}`);
    
    if (results.length === 0) {
      console.warn(`[${processorId}] No results returned from DeepSeek API`);
      // Log more details about the response to help debug why no results were returned
      console.log(`[${processorId}] Full response structure: ${JSON.stringify(apiResponse, null, 2).substring(0, 1000)}...`);
    } else {
      // Log the structure of the first result to understand format
      console.log(`[${processorId}] First result keys: ${Object.keys(results[0])}`);
      console.log(`[${processorId}] First result sample: ${JSON.stringify(results[0]).substring(0, 500)}...`);
    }

    // Map results to a consistent structure
    console.log(`[${processorId}] Normalizing ${results.length} results...`);
    
    const normalizedResults = results.map((result: any, index: number) => {
      try {
        // Check if we're using the new enhanced format
        if (hasNewFormat) {
          // New format mapping
          const purchasingOptions = Array.isArray(result.purchasing_options) 
            ? result.purchasing_options.map((option: any) => ({
                name: option.retailer_name || 'Unknown Retailer',
                url: option.retailer_url || '',
                price: typeof option.price === 'number' ? option.price : 
                       typeof option.price === 'string' ? parseFloat(option.price) : 0,
                isLowestPrice: option.is_lowest_price === true,
                isReputable: option.is_reputable === true
              }))
            : [];
            
          return {
            id: result.id || `product-${Math.random().toString(36).substring(2, 9)}`,
            name: result.product_name || 'Unnamed Product',
            description: result.description || '',
            price_range: typeof result.average_price === 'number' 
              ? `Around ${result.average_price}` 
              : 'Price not available',
            price: result.average_price || 0,
            rating: typeof result.star_rating === 'number' ? result.star_rating : 0,
            reviewCount: result.review_count || 0,
            image_url: result.image_url || '',
            pros: [result.pros || ''],
            cons: [result.cons || ''],
            retailers: purchasingOptions
          };
        } else {
          // Original format mapping
          return {
            id: result.id || `product-${Math.random().toString(36).substring(2, 9)}`,
            name: result.name || result.product_name || result.title || 'Unnamed Product',
            description: result.description || result.summary || '',
            price_range: result.price_range || result.price || 'Price not available',
            rating: typeof result.rating === 'number' ? result.rating : 
                  typeof result.score === 'number' ? result.score / 2 : 0, // Convert 10-scale to 5-scale if needed
            pros: Array.isArray(result.pros) ? result.pros : [],
            cons: Array.isArray(result.cons) ? result.cons : [],
            retailers: Array.isArray(result.retailers) ? result.retailers.map((retailer: any) => ({
              name: retailer.name || 'Unknown Retailer',
              price: retailer.price || 'Price not available',
              url: retailer.url || ''
            })) : []
          };
        }
      } catch (resultError) {
        console.error(`[${processorId}] Error processing result at index ${index}:`, resultError);
        
        // Return a placeholder product rather than failing the entire process
        return {
          id: `error-product-${index}`,
          name: `Error processing product ${index}`,
          description: 'There was an error processing this product data',
          price_range: 'Unknown',
          rating: 0,
          pros: ['Data unavailable'],
          cons: ['Data unavailable'],
          retailers: []
        };
      }
    });

    console.log(`[${processorId}] Successfully normalized ${normalizedResults.length} products`);

    // Ensure we have at least some pros and cons for each product
    normalizedResults.forEach((product: any, index: number) => {
      try {
        // Check if pros/cons are empty and try to populate from other fields
        if ((!product.pros || product.pros.length === 0) && product.highlights) {
          product.pros = Array.isArray(product.highlights) ? product.highlights : [];
        }

        if ((!product.cons || product.cons.length === 0) && product.limitations) {
          product.cons = Array.isArray(product.limitations) ? product.limitations : [];
        }
      } catch (proConsError) {
        console.error(`[${processorId}] Error processing pros/cons for product ${index}:`, proConsError);
      }
    });

    // Create a properly structured response
    const finalResponse = {
      results: normalizedResults,
      query: apiResponse.query || '',
      filters: apiResponse.filters || {},
      total_results: normalizedResults.length,
    };
    
    console.log(`[${processorId}] Processed response successfully with ${finalResponse.total_results} results`);
    return finalResponse;
  } catch (error) {
    console.error(`[${processorId}] Error processing DeepSeek search response:`, error);
    console.error(`[${processorId}] Response snippet:`, 
      apiResponse ? JSON.stringify(apiResponse).substring(0, 300) + '...' : 'null or undefined');
    
    if (error instanceof Error && error.stack) {
      console.error(`[${processorId}] Error stack:`, error.stack);
    }
    
    // Return an empty but valid response structure instead of throwing
    return {
      results: [],
      query: apiResponse?.query || '',
      filters: {},
      total_results: 0,
      error: error instanceof Error ? error.message : 'Unknown error processing API response',
      processing_error: true
    };
  }
}

/**
 * Enhanced processing for DeepSeek comparison responses
 * @param apiResponse Raw comparison response from DeepSeek
 * @returns Normalized comparison data
 */
function processDeepSeekComparisonResponse(apiResponse: any): any {
  // Create a unique processor ID for this response processing operation
  const processorId = `proc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${processorId}] Processing DeepSeek comparison response...`);
  
  try {
    // Validate the response format
    if (!apiResponse) {
      console.error(`[${processorId}] Invalid comparison response: empty or null`);
      throw new Error('Invalid comparison response format from DeepSeek API: empty or null response');
    }
    
    if (typeof apiResponse !== 'object') {
      console.error(`[${processorId}] Invalid comparison response: not an object, type=${typeof apiResponse}`);
      throw new Error(`Invalid comparison response format from DeepSeek API: expected object, got ${typeof apiResponse}`);
    }
    
    // Log response keys and structure
    console.log(`[${processorId}] Comparison response keys: ${JSON.stringify(Object.keys(apiResponse))}`);
    
    // If response is an error message
    if (apiResponse.error || apiResponse.errors) {
      const errorMsg = apiResponse.error || 
                      (Array.isArray(apiResponse.errors) ? apiResponse.errors.join(', ') : apiResponse.errors);
      console.error(`[${processorId}] DeepSeek API returned comparison error: ${errorMsg}`);
      throw new Error(`DeepSeek API comparison error: ${errorMsg}`);
    }

    // Check for products array
    const hasProducts = Array.isArray(apiResponse.products);
    console.log(`[${processorId}] Has products array: ${hasProducts}, count: ${hasProducts ? apiResponse.products.length : 0}`);
    
    // Check for comparison object
    const hasComparison = apiResponse.comparison && typeof apiResponse.comparison === 'object';
    console.log(`[${processorId}] Has comparison object: ${hasComparison}`);
    
    if (hasComparison) {
      console.log(`[${processorId}] Comparison object keys: ${Object.keys(apiResponse.comparison).join(', ')}`);
    }
    
    // Normalize the products array
    const products = hasProducts
      ? apiResponse.products.map((product: any, index: number) => {
          try {
            return {
              id: product.id || `product-${Math.random().toString(36).substring(2, 9)}`,
              name: product.name || 'Unnamed Product',
              price_range: product.price_range || 'Price not available',
              rating: typeof product.rating === 'number' ? product.rating : 0
            };
          } catch (productError) {
            console.error(`[${processorId}] Error processing product at index ${index}:`, productError);
            return {
              id: `error-product-${index}`,
              name: `Error Processing Product ${index}`,
              price_range: 'Unknown',
              rating: 0
            };
          }
        })
      : [];
    
    console.log(`[${processorId}] Normalized ${products.length} products`);

    // Normalize the comparison object
    const comparison = hasComparison
      ? (() => {
          try {
            // Extract key sections from comparison
            const comparisonData = apiResponse.comparison;
            
            // Ensure there's a conclusion
            if (!comparisonData.conclusion) {
              console.log(`[${processorId}] No conclusion found, adding default`);
              comparisonData.conclusion = 'No conclusion available for this comparison';
            }
            
            // Ensure similarities and differences are arrays
            if (!Array.isArray(comparisonData.similarities)) {
              console.log(`[${processorId}] Similarities not in expected format, normalizing`);
              comparisonData.similarities = [];
            }
            
            if (!Array.isArray(comparisonData.differences)) {
              console.log(`[${processorId}] Differences not in expected format, normalizing`);
              comparisonData.differences = [];
            }
            
            // Check for categories
            if (comparisonData.categories && typeof comparisonData.categories === 'object') {
              console.log(`[${processorId}] Found ${Object.keys(comparisonData.categories).length} comparison categories`);
            } else {
              console.log(`[${processorId}] No categories found`);
              comparisonData.categories = {};
            }
            
            return comparisonData;
          } catch (comparisonError) {
            console.error(`[${processorId}] Error processing comparison data:`, comparisonError);
            return { 
              conclusion: 'Error processing comparison data',
              similarities: [],
              differences: [],
              categories: {}
            };
          }
        })()
      : { conclusion: 'No comparison data available', similarities: [], differences: [], categories: {} };

    const result = {
      products,
      comparison,
      request_id: processorId
    };
    
    console.log(`[${processorId}] Successfully processed comparison response`);
    return result;
  } catch (error) {
    console.error(`[${processorId}] Error processing DeepSeek comparison response:`, error);
    console.error(`[${processorId}] Response snippet:`, 
      apiResponse ? JSON.stringify(apiResponse).substring(0, 300) + '...' : 'null or undefined');
    
    if (error instanceof Error && error.stack) {
      console.error(`[${processorId}] Error stack:`, error.stack);
    }
    
    // Return a valid but empty response structure
    return {
      products: [],
      comparison: {
        conclusion: 'Error processing comparison results',
        similarities: [],
        differences: [],
        categories: {}
      },
      error: error instanceof Error ? error.message : 'Unknown error processing comparison response',
      processing_error: true,
      request_id: processorId
    };
  }
}

/**
 * Generate a mock search response for testing and development
 * @param query The search query
 * @param filters Any filters applied
 * @returns Mock search response data
 */
function generateMockSearchResponse(query: string, filters: any = {}): any {
  const requestId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create an array of mock products using the enhanced format
  const mockProducts = [
    {
      id: `product-${Math.random().toString(36).substr(2, 9)}`,
      product_name: `Premium ${query} Model X`,
      image_url: "https://example.com/product-placeholder.jpg",
      average_price: 299.99,
      star_rating: 4.7,
      review_count: 842,
      pros: `Compared to competing models from Brand Y, this product offers superior battery life and performance under heavy loads. While alternatives in this price range typically offer 8-10 hours of usage, this model consistently delivers 12+ hours even with intensive applications running. The build quality is exceptional with aircraft-grade aluminum that feels significantly more premium than the plastic construction of Competitor Z.`,
      cons: `While Alternative A offers a more compact design, this model is slightly bulkier and heavier. The premium materials do come at a cost, making this product about 15-20% more expensive than the mid-range options from Brand B, though the extended warranty and better support justify this difference for many users.`,
      purchasing_options: [
        {
          retailer_name: "MegaShop",
          retailer_url: "https://example.com/megashop/product1",
          price: 289.99,
          is_lowest_price: true,
          is_reputable: true
        },
        {
          retailer_name: "TechZone",
          retailer_url: "https://example.com/techzone/premium-model",
          price: 299.99,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: "DiscountDeals",
          retailer_url: "https://example.com/discountdeals/item123",
          price: 279.99,
          is_lowest_price: true,
          is_reputable: false
        },
        {
          retailer_name: "QuickBuy",
          retailer_url: "https://example.com/quickbuy/modelx",
          price: 309.99,
          is_lowest_price: false,
          is_reputable: false
        }
      ]
    },
    {
      id: `product-${Math.random().toString(36).substr(2, 9)}`,
      product_name: `Value ${query} Basic`,
      image_url: "https://example.com/product-placeholder-2.jpg",
      average_price: 149.99,
      star_rating: 4.2,
      review_count: 1203,
      pros: `Compared to other budget-friendly options like EconoTech, this product maintains surprisingly good performance while cutting the price in half compared to premium alternatives. While Competitor X's budget model sacrifices essential features, this product retains all core functionality that most users need. The interface is notably more intuitive than similar options in this price range.`,
      cons: `When compared to Premium Model Z, this product uses lower quality materials that don't feel as durable in day-to-day use. While higher-end alternatives can handle multiple demanding tasks simultaneously, this model shows noticeable slowdowns when pushed beyond basic usage patterns. The manufacturer offers less comprehensive support than what you'd find with FirstClass Brand.`,
      purchasing_options: [
        {
          retailer_name: "BudgetBuy",
          retailer_url: "https://example.com/budgetbuy/value-basic",
          price: 139.99,
          is_lowest_price: true,
          is_reputable: false
        },
        {
          retailer_name: "MegaShop",
          retailer_url: "https://example.com/megashop/basic-model",
          price: 149.99,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: "ValueKing",
          retailer_url: "https://example.com/valueking/item456",
          price: 144.99,
          is_lowest_price: true,
          is_reputable: false
        },
        {
          retailer_name: "TrustedTech",
          retailer_url: "https://example.com/trustedtech/basic",
          price: 159.99,
          is_lowest_price: false,
          is_reputable: true
        }
      ]
    }
  ];
  
  // Add more mock products if needed
  for (let i = 0; i < 2; i++) {
    const price = Math.floor(Math.random() * 400) + 99;
    mockProducts.push({
      id: `product-${Math.random().toString(36).substr(2, 9)}`,
      product_name: `${query} Standard Edition ${i + 1}`,
      image_url: `https://example.com/product-placeholder-${i + 3}.jpg`,
      average_price: price,
      star_rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
      review_count: Math.floor(Math.random() * 1000) + 100,
      pros: `Compared to similar products from Brand ${String.fromCharCode(65 + i)}, this model offers better value with its combination of features and price point. While Competitor ${String.fromCharCode(75 + i)} focuses on specialized features, this product provides a more balanced experience for most users. The manufacturer has improved reliability significantly compared to previous generations.`,
      cons: `Unlike Premium Alternative ${String.fromCharCode(85 + i)} which excels in advanced scenarios, this product is more limited in specialized use cases. The materials, while durable, don't match the premium feel of high-end competitors. Some users report that Rival Brand ${String.fromCharCode(75 + i)} offers more intuitive controls for beginners.`,
      purchasing_options: [
        {
          retailer_name: `Retailer${i + 1}A`,
          retailer_url: `https://example.com/retailer${i + 1}a/standard-edition`,
          price: price - 10,
          is_lowest_price: true,
          is_reputable: i % 2 === 0
        },
        {
          retailer_name: `Retailer${i + 1}B`,
          retailer_url: `https://example.com/retailer${i + 1}b/standard-edition`,
          price: price,
          is_lowest_price: false,
          is_reputable: true
        },
        {
          retailer_name: `Retailer${i + 1}C`,
          retailer_url: `https://example.com/retailer${i + 1}c/standard-edition`,
          price: price - 15,
          is_lowest_price: true,
          is_reputable: false
        },
        {
          retailer_name: `Retailer${i + 1}D`,
          retailer_url: `https://example.com/retailer${i + 1}d/standard-edition`,
          price: price + 20,
          is_lowest_price: false,
          is_reputable: i % 2 !== 0
        }
      ]
    });
  }

  // Return formatted response
  return {
    products: mockProducts,
    query: query,
    filters: filters,
    request_id: requestId,
    total_results: mockProducts.length,
    source: 'synthetic',
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate mock comparison response data for testing or when API is not available
 */
function generateMockComparisonResponse(productIds: string[]): any {
  const products = productIds.map((id, index) => ({
    id,
    name: index === 0 ? 'Premium Widget XL' : 'Budget Widget',
    price_range: index === 0 ? '$50-$75' : '$25-$40',
    rating: index === 0 ? 4.5 : 3.8
  }));
  
  return {
    products,
    comparison: {
      design: {
        'Premium Widget XL': 'Premium materials with durable construction',
        'Budget Widget': 'Plastic construction with adequate durability'
      },
      performance: {
        'Premium Widget XL': 'High performance with fast processing',
        'Budget Widget': 'Adequate for basic tasks'
      },
      value: {
        'Premium Widget XL': 'Higher price but better long-term value',
        'Budget Widget': 'Excellent short-term value for price'
      },
      conclusion: 'Premium Widget XL offers better quality and features but at a higher price. Budget Widget is a good option for those with simpler needs or limited budgets.'
    },
    is_mock: true
  };
} 