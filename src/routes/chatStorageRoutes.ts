import express from 'express';
import * as chatStorageController from '../controllers/chatStorageController';
import { conditionalAuth } from '../middleware/auth';

const router = express.Router();

// Protected routes with API key authentication
router.post('/conversations', conditionalAuth('/chat-storage/conversations'), chatStorageController.createConversation);
router.post('/messages', conditionalAuth('/chat-storage/messages'), chatStorageController.addMessage);
router.get('/conversations/:userId', conditionalAuth('/chat-storage/conversations'), chatStorageController.getConversations);
router.get('/messages/:conversationId', conditionalAuth('/chat-storage/messages'), chatStorageController.getMessages);
router.put('/conversations/:conversationId/archive', conditionalAuth('/chat-storage/conversations'), chatStorageController.archiveConversation);

export default router; 