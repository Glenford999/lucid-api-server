import express, { Request, Response } from 'express';

const router = express.Router();

// Basic placeholder for API routes
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Chat API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Mock completion endpoint
router.post('/openai/chat', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      id: 'mock-completion-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response as the OpenAI API key is not configured.'
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
});

// Mock shopping assistant endpoint
router.post('/openai/shopping-assistant', (req: Request, res: Response) => {
  const { query } = req.body;
  
  res.status(200).json({
    success: true,
    data: {
      id: 'mock-completion-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[Mock Response] Based on your query about ${query || 'products'}, I would recommend looking at a range of options. Consider both premium and budget-friendly alternatives. Always compare reviews before making a purchase decision.`
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
});

// Export the router
export const chatRoutes = router; 