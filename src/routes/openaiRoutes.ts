import express from 'express';
import * as openaiController from '../controllers/openaiController';
import { conditionalAuth } from '../middleware/auth';

const router = express.Router();

// Protected routes with API key authentication
router.post('/chat', conditionalAuth('/openai/chat'), openaiController.chatCompletion);
router.post('/shopping-assistant', conditionalAuth('/openai/shopping-assistant'), openaiController.shoppingAssistant);

export default router; 