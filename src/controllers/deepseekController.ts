import { Request, Response } from 'express';
import config from '../config/config';
import axios from 'axios';

/**
 * Controller for handling DeepSeek AI product search
 */
export const productSearch = async (req: Request, res: Response) => {
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
        data: generateMockSearchResponse(query, filters)
      });
    }
    
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
    
    console.log(`Making request to DeepSeek API at ${deepseekApiEndpoint} for query: "${query}"`);
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': deepseekApiKey,
      'X-Timestamp': timestamp
    };
    
    // Make the actual request to DeepSeek API
    try {
      const deepseekResponse = await axios.post(
        `${deepseekApiEndpoint}/v1/product/search`,
        deepseekRequest,
        { headers }
      );
      
      // Process and format the response
      const processedResponse = processDeepSeekSearchResponse(deepseekResponse.data);
      
      return res.status(200).json({
        success: true,
        data: processedResponse
      });
    } catch (apiError: any) {
      console.error('DeepSeek API request failed:', apiError.message);
      
      // Fall back to mock data if API request fails
      return res.status(200).json({
        success: true,
        data: generateMockSearchResponse(query, filters),
        is_fallback: true
      });
    }
    
  } catch (error: any) {
    console.error('DeepSeek API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};

/**
 * Controller for handling DeepSeek AI product comparison
 */
export const productComparison = async (req: Request, res: Response) => {
  try {
    const { product_ids, comparison_type, include_categories, include_conclusion } = req.body;
    
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
      console.warn('DeepSeek API not configured, returning mock data');
      return res.status(200).json({
        success: true,
        data: generateMockComparisonResponse(product_ids)
      });
    }
    
    // Format request for DeepSeek API
    const deepseekRequest = {
      product_ids,
      comparison_type: comparison_type || 'detailed',
      include_categories: include_categories || ['design', 'performance', 'features', 'value'],
      include_conclusion: include_conclusion !== false
    };
    
    console.log(`Making comparison request to DeepSeek API for products:`, product_ids);
    
    // Create API signature and headers
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': deepseekApiKey,
      'X-Timestamp': timestamp
    };
    
    // Make the actual request to DeepSeek API
    try {
      const deepseekResponse = await axios.post(
        `${deepseekApiEndpoint}/v1/product/compare`,
        deepseekRequest,
        { headers }
      );
      
      // Process and format the response
      const processedResponse = processDeepSeekComparisonResponse(deepseekResponse.data);
      
      return res.status(200).json({
        success: true,
        data: processedResponse
      });
    } catch (apiError: any) {
      console.error('DeepSeek API request failed:', apiError.message);
      
      // Fall back to mock data if API request fails
      return res.status(200).json({
        success: true,
        data: generateMockComparisonResponse(product_ids),
        is_fallback: true
      });
    }
    
  } catch (error: any) {
    console.error('DeepSeek API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
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
  try {
    // First, check if the response is valid
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('Invalid response format from DeepSeek API');
    }

    // Check if response is using the new format with "products" key for enhanced prompt
    const hasNewFormat = apiResponse.products && Array.isArray(apiResponse.products);
    
    // Get results from the appropriate source
    const results = hasNewFormat 
      ? apiResponse.products 
      : Array.isArray(apiResponse.results) 
        ? apiResponse.results 
        : [];

    if (results.length === 0) {
      console.log('No results returned from DeepSeek API');
    }

    // Map results to a consistent structure
    const normalizedResults = results.map((result: any) => {
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
    });

    // Ensure we have at least some pros and cons for each product
    normalizedResults.forEach((product: any) => {
      // Check if pros/cons are empty and try to populate from other fields
      if ((!product.pros || product.pros.length === 0) && product.highlights) {
        product.pros = Array.isArray(product.highlights) ? product.highlights : [];
      }

      if ((!product.cons || product.cons.length === 0) && product.limitations) {
        product.cons = Array.isArray(product.limitations) ? product.limitations : [];
      }
    });

    // Create a properly structured response
    return {
      results: normalizedResults,
      query: apiResponse.query || '',
      filters: apiResponse.filters || {},
      total_results: normalizedResults.length,
    };
  } catch (error) {
    console.error('Error processing DeepSeek search response:', error);
    throw new Error('Failed to process search results from DeepSeek API');
  }
}

/**
 * Enhanced processing for DeepSeek comparison responses
 * @param apiResponse Raw comparison response from DeepSeek
 * @returns Normalized comparison data
 */
function processDeepSeekComparisonResponse(apiResponse: any): any {
  try {
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('Invalid comparison response format from DeepSeek API');
    }

    // Normalize the products array
    const products = Array.isArray(apiResponse.products) 
      ? apiResponse.products.map((product: any) => ({
          id: product.id || `product-${Math.random().toString(36).substring(2, 9)}`,
          name: product.name || 'Unnamed Product',
          price_range: product.price_range || 'Price not available',
          rating: typeof product.rating === 'number' ? product.rating : 0
        }))
      : [];

    // Normalize the comparison object
    const comparison = apiResponse.comparison && typeof apiResponse.comparison === 'object'
      ? apiResponse.comparison
      : { conclusion: 'No comparison data available' };

    // Ensure there's a conclusion
    if (!comparison.conclusion) {
      comparison.conclusion = 'No conclusion available for this comparison';
    }

    return {
      products,
      comparison,
    };
  } catch (error) {
    console.error('Error processing DeepSeek comparison response:', error);
    throw new Error('Failed to process comparison results from DeepSeek API');
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