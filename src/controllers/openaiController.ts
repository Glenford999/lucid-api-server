import { Request, Response } from 'express';
import OpenAI from 'openai';
import config from '../config/config';

// Initialize the OpenAI client if API key is available
let openai: OpenAI | null = null;
try {
  if (config.openai.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  } else {
    console.warn('OpenAI API key not configured. Using mock responses instead.');
  }
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
}

// Properly type the messages for OpenAI
type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Type for product data
interface ProductData {
  id: string;
  name: string;
  description?: string;
  price_range?: string;
  rating?: number;
  pros?: string[];
  cons?: string[];
  features?: string[];
  retailer_links?: { name: string; url: string }[];
}

/**
 * Controller for handling chat completions
 */
export const chatCompletion = async (req: Request, res: Response) => {
  try {
    const { 
      messages, 
      model = config.openai.model, 
      temperature = 0.7, 
      max_tokens = 1000,
      stream = false 
    } = req.body;
    
    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: messages array is required'
      });
    }
    
    // If OpenAI client is not initialized, return mock response
    if (!openai) {
      console.log('Using mock response for chat completion');
      return res.status(200).json({
        success: true,
        data: {
          id: 'mock-completion-id',
          object: 'chat.completion',
          created: Date.now(),
          model: model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a mock response as the OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          is_mock: true
        }
      });
    }
    
    // Handle streaming response if requested
    if (stream) {
      // Set appropriate headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Call the OpenAI API with streaming enabled
      const stream = await openai.chat.completions.create({
        model,
        messages: messages as ChatMessage[],
        temperature,
        max_tokens,
        stream: true,
      });
      
      // Set initial response
      res.write('data: ' + JSON.stringify({ 
        type: 'stream_start', 
        timestamp: new Date().toISOString() 
      }) + '\n\n');
      
      // Process each chunk from the stream
      for await (const chunk of stream) {
        // Extract the content delta
        const content = chunk.choices[0]?.delta?.content || '';
        
        // Send the chunk to the client if it has content
        if (content) {
          res.write('data: ' + JSON.stringify({
            type: 'content',
            content
          }) + '\n\n');
        }
      }
      
      // Send end of stream marker
      res.write('data: ' + JSON.stringify({ 
        type: 'stream_end',
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
      // End the response
      return res.end();
    } else {
      // Standard non-streaming response
      const completion = await openai.chat.completions.create({
        model,
        messages: messages as ChatMessage[],
        temperature,
        max_tokens,
      });
      
      // Return the response
      return res.status(200).json({
        success: true,
        data: completion
      });
    }
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};

/**
 * Controller for handling shopping assistant prompts
 */
export const shoppingAssistant = async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      productCategory, 
      priceRange, 
      preferences,
      productData,
      stream = false
    } = req.body;
    
    // Validate request
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: query is required'
      });
    }
    
    // Construct the system message with shopping assistant context
    let systemContent = `You are a helpful shopping research assistant that helps users find the best products. 
    Your goal is to provide informative, balanced, and well-researched product recommendations.
    Focus on factual information and highlight both pros and cons.
    If asked about product prices, always provide a range and mention that prices may vary by retailer.
    Never make up specific prices, models, or availability without data.
    ${productCategory ? `The user is interested in: ${productCategory}` : ''}
    ${priceRange ? `Their budget is: ${priceRange}` : ''}
    ${preferences ? `Their preferences include: ${preferences}` : ''}`;
    
    // Add product data context if provided
    if (productData && Array.isArray(productData) && productData.length > 0) {
      const productContext = enrichContextWithProductData(productData);
      systemContent += `\n\nHere is information about relevant products that you can reference:\n${productContext}`;
    }
    
    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemContent
    };
    
    // Construct user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: query
    };
    
    // If OpenAI client is not initialized, return mock response
    if (!openai) {
      console.log('Using mock response for shopping assistant');
      return res.status(200).json({
        success: true,
        data: {
          id: 'mock-completion-id',
          object: 'chat.completion',
          created: Date.now(),
          model: config.openai.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `[Mock Response] Based on your query about ${query}, I would recommend looking at a range of options. ${productCategory ? `Since you're interested in ${productCategory}, ` : ''}${priceRange ? `with a budget of ${priceRange}, ` : ''}consider both premium and budget-friendly alternatives. Always compare reviews before making a purchase decision.`
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          is_mock: true
        }
      });
    }
    
    // Prepare messages array
    const messages = [systemMessage, userMessage];
    
    // Handle streaming response if requested
    if (stream) {
      // Set appropriate headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Call the OpenAI API with streaming enabled
      const stream = await openai.chat.completions.create({
        model: config.openai.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
      
      // Set initial response
      res.write('data: ' + JSON.stringify({ 
        type: 'stream_start', 
        timestamp: new Date().toISOString() 
      }) + '\n\n');
      
      // Process each chunk from the stream
      for await (const chunk of stream) {
        // Extract the content delta
        const content = chunk.choices[0]?.delta?.content || '';
        
        // Send the chunk to the client if it has content
        if (content) {
          res.write('data: ' + JSON.stringify({
            type: 'content',
            content
          }) + '\n\n');
        }
      }
      
      // Send end of stream marker
      res.write('data: ' + JSON.stringify({ 
        type: 'stream_end',
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
      // End the response
      return res.end();
    } else {
      // Standard non-streaming response
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      // Return the response
      return res.status(200).json({
        success: true,
        data: completion
      });
    }
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your request'
    });
  }
};

/**
 * Helper function to format product data into context for the AI
 */
function enrichContextWithProductData(products: ProductData[]): string {
  let context = '';
  
  products.forEach((product, index) => {
    context += `Product ${index + 1}: ${product.name}\n`;
    
    if (product.description) {
      context += `Description: ${product.description}\n`;
    }
    
    if (product.price_range) {
      context += `Price Range: ${product.price_range}\n`;
    }
    
    if (product.rating !== undefined) {
      context += `Rating: ${product.rating}/5\n`;
    }
    
    if (product.pros && product.pros.length > 0) {
      context += `Pros:\n` + product.pros.map(pro => `- ${pro}`).join('\n') + '\n';
    }
    
    if (product.cons && product.cons.length > 0) {
      context += `Cons:\n` + product.cons.map(con => `- ${con}`).join('\n') + '\n';
    }
    
    if (product.features && product.features.length > 0) {
      context += `Key Features:\n` + product.features.map(feature => `- ${feature}`).join('\n') + '\n';
    }
    
    if (product.retailer_links && product.retailer_links.length > 0) {
      context += `Available at: ${product.retailer_links.map(link => link.name).join(', ')}\n`;
    }
    
    context += '\n';
  });
  
  return context;
} 