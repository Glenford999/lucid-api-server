/**
 * DeepSeek Controller Tests
 * Test suite for validating the deepseekController functionality
 */

const deepseekController = require('../controllers/deepseekController');

describe('DeepSeek Controller - Search Response Processing', () => {
  test('processDeepSeekSearchResponse handles valid response', () => {
    // Mock API response data
    const mockApiResponse = {
      products: [
        {
          product_name: 'Test Product',
          image_url: 'https://example.com/image.jpg',
          average_price: '99.99',
          star_rating: '4.5',
          review_count: '120',
          pros: 'Good quality',
          cons: 'Expensive',
          purchasing_options: [
            {
              retailer_name: 'Test Store',
              retailer_url: 'https://example.com/store',
              price: '99.99',
              is_lowest_price: true,
              is_reputable: true
            }
          ]
        }
      ],
      query: 'test query',
      filters: { price: 'high' }
    };

    // Process the response
    const result = deepseekController.processDeepSeekSearchResponse(mockApiResponse);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.results).toHaveLength(1);
    expect(result.query).toBe('test query');
    expect(result.total_results).toBe(1);

    // Verify product data transformation
    const product = result.results[0];
    expect(product.name).toBe('Test Product');
    expect(product.price.value).toBe(99.99);
    expect(product.rating.value).toBe(4.5);
    expect(product.purchasing_options).toHaveLength(1);
  });

  test('processDeepSeekSearchResponse handles empty response', () => {
    // Mock empty API response
    const mockEmptyResponse = null;

    // Process the response
    const result = deepseekController.processDeepSeekSearchResponse(mockEmptyResponse);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.results).toHaveLength(0);
    expect(result.total_results).toBe(0);
  });

  test('processDeepSeekSearchResponse handles invalid product data', () => {
    // Mock API response with invalid product data
    const mockInvalidResponse = {
      products: [
        {
          // Missing required fields
        }
      ],
      query: 'test query'
    };

    // Process the response
    const result = deepseekController.processDeepSeekSearchResponse(mockInvalidResponse);

    // Verify the result still has a valid structure
    expect(result).toBeDefined();
    expect(result.results).toHaveLength(1);
    
    // Check default values were used
    const product = result.results[0];
    expect(product.name).toBe('Unnamed Product');
    expect(product.price.value).toBe(0);
  });
});

describe('DeepSeek Controller - Comparison Response Processing', () => {
  test('processDeepSeekComparisonResponse handles valid response', () => {
    // Mock API comparison response
    const mockComparisonResponse = {
      products: [
        {
          id: 'prod_123',
          name: 'Product A',
          price: { value: 99.99 },
          rating: { value: 4.5, count: 120 }
        },
        {
          id: 'prod_456',
          name: 'Product B',
          price: { value: 149.99 },
          rating: { value: 4.8, count: 85 }
        }
      ],
      comparisons: [
        {
          category: 'Design',
          analysis: ['Product A has better design', 'Product B is more compact'],
          winner: 'prod_123'
        }
      ],
      conclusion: 'Product A is better overall'
    };

    // Process the response
    const result = deepseekController.processDeepSeekComparisonResponse(mockComparisonResponse);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.products).toHaveLength(2);
    expect(result.comparisons).toHaveLength(1);
    expect(result.conclusion).toBe('Product A is better overall');

    // Verify product data
    expect(result.products[0].name).toBe('Product A');
    expect(result.products[1].name).toBe('Product B');

    // Verify comparison data
    expect(result.comparisons[0].category).toBe('Design');
    expect(result.comparisons[0].winner).toBe('prod_123');
  });

  test('processDeepSeekComparisonResponse handles empty response', () => {
    // Mock empty API response
    const mockEmptyResponse = null;

    // Process the response
    const result = deepseekController.processDeepSeekComparisonResponse(mockEmptyResponse);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.products).toHaveLength(0);
    expect(result.comparisons).toHaveLength(0);
    expect(result.conclusion).toBe('');
  });
});

describe('DeepSeek Controller - Mock Data Generation', () => {
  test('generateMockSearchResponse creates valid mock data', () => {
    // Generate mock search data
    const result = deepseekController.generateMockSearchResponse('test query');

    // Verify the result
    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.query).toBe('test query');
    
    // Verify product structure
    const product = result.results[0];
    expect(product.id).toBeDefined();
    expect(product.name).toBeDefined();
    expect(product.price).toBeDefined();
    expect(product.rating).toBeDefined();
    expect(product.purchasing_options).toBeDefined();
  });

  test('generateMockComparisonResponse creates valid mock comparison data', () => {
    // Generate mock comparison data
    const productIds = ['prod_123', 'prod_456'];
    const result = deepseekController.generateMockComparisonResponse(productIds);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.products).toHaveLength(2);
    expect(result.products[0].id).toBe('prod_123');
    expect(result.products[1].id).toBe('prod_456');
    expect(result.comparisons).toBeDefined();
    expect(result.conclusion).toBeDefined();
  });
});

describe('DeepSeek Controller - Utility Functions', () => {
  test('formatPrice formats prices correctly', () => {
    // Test with USD
    expect(deepseekController.formatPrice(99.99, 'USD')).toBe('$99.99');
    
    // Test with EUR
    expect(deepseekController.formatPrice(99.99, 'EUR')).toBe('€99.99');
    
    // Test with invalid price
    expect(deepseekController.formatPrice(NaN, 'USD')).toBe('');
    
    // Test with no currency specified (defaults to USD)
    expect(deepseekController.formatPrice(99.99)).toBe('$99.99');
  });
}); 