import { Router } from 'express';
import * as deepseekController from '../controllers/deepseekController';
import * as deepseekStatusController from '../controllers/deepseekStatusController';
import { conditionalAuth } from '../middleware/auth';

const router = Router();

// Protected routes with API key authentication
router.post('/product-search', conditionalAuth('/deepseek/product-search'), deepseekController.productSearch);
router.post('/product-comparison', conditionalAuth('/deepseek/product-comparison'), deepseekController.productComparison);
router.get('/status', conditionalAuth('/deepseek/status'), deepseekStatusController.getDeepseekStatus);

export default router; 