import { Router } from 'express';
import { testDeepSeekConnection } from '../controllers/testController';

const router = Router();

// Test DeepSeek API connection
router.get('/test/deepseek', testDeepSeekConnection);

export default router; 