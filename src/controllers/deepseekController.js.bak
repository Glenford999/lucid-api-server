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
      console.warn('DeepSeek API not configured, returning mock data');
      return res.status(200).json({
        success: true,
        data: generateMockSearchResponse(query, filters),
        is_mock: true,
        reason: 'API_NOT_CONFIGURED'
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
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': deepseekApiKey,
      'X-Timestamp': timestamp
    };
    
    // Add request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Make the actual request to DeepSeek API with timeout and retry logic
    try {
      console.log(`[${requestId}] Sending request to DeepSeek API...`);
      
      const deepseekResponse = await axios.post(
        `${deepseekApiEndpoint}/v1/product/search`,
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
    } catch (apiError) {
      console.error(`[${requestId}] DeepSeek API request failed:`, apiError.message);
      
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
      
      // Fall back to mock data if API request fails
      return res.status(200).json({
        success: true,
        data: generateMockSearchResponse(query, filters),
        is_fallback: true,
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

// Rest of the code remains the same... 