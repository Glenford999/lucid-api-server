/// <reference types="jest" />

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import request from 'supertest';
import * as chatStorageController from '../../controllers/chatStorageController';

// Mock the controller functions
jest.mock('../../controllers/chatStorageController', () => ({
  createConversation: jest.fn().mockImplementation(function(req, res) {
    return res.status(201).json({ success: true, data: { id: 'mock-conversation-id' } });
  }),
  addMessage: jest.fn().mockImplementation(function(req, res) {
    return res.status(201).json({ success: true, data: { id: 'mock-message-id' } });
  }),
  getConversations: jest.fn().mockImplementation(function(req, res) {
    return res.status(200).json({ success: true, data: [] });
  }),
  getMessages: jest.fn().mockImplementation(function(req, res) {
    return res.status(200).json({ success: true, data: [] });
  }),
  archiveConversation: jest.fn().mockImplementation(function(req, res) {
    return res.status(200).json({ success: true, data: { id: 'mock-conversation-id', is_archived: true } });
  }),
}));

// Create a mock middleware function for testing
const mockMiddleware = jest.fn((req, res, next) => next());

// Mock the auth middleware - simpler approach without tracking
jest.mock('../../middleware/auth', () => ({
  conditionalAuth: () => mockMiddleware
}));

// Import the router after mocks have been setup
import router from '../../routes/chatStorageRoutes';

describe('Chat Storage Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/chat-storage', router);
    jest.clearAllMocks();
  });

  describe('POST /conversations', () => {
    it('should call createConversation controller', async () => {
      const response = await request(app)
        .post('/api/chat-storage/conversations')
        .send({ user_id: 'test-user', title: 'Test Conversation' });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'mock-conversation-id' }
      });
      expect(chatStorageController.createConversation).toHaveBeenCalled();
    });
  });

  describe('POST /messages', () => {
    it('should call addMessage controller', async () => {
      const response = await request(app)
        .post('/api/chat-storage/messages')
        .send({
          conversation_id: 'test-conversation',
          user_id: 'test-user',
          content: 'Test message',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'mock-message-id' }
      });
      expect(chatStorageController.addMessage).toHaveBeenCalled();
    });
  });

  describe('GET /conversations/:userId', () => {
    it('should call getConversations controller', async () => {
      const response = await request(app)
        .get('/api/chat-storage/conversations/test-user');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: []
      });
      expect(chatStorageController.getConversations).toHaveBeenCalled();
    });
  });

  describe('GET /messages/:conversationId', () => {
    it('should call getMessages controller', async () => {
      const response = await request(app)
        .get('/api/chat-storage/messages/test-conversation');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: []
      });
      expect(chatStorageController.getMessages).toHaveBeenCalled();
    });
  });

  describe('PUT /conversations/:conversationId/archive', () => {
    it('should call archiveConversation controller', async () => {
      const response = await request(app)
        .put('/api/chat-storage/conversations/test-conversation/archive');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'mock-conversation-id', is_archived: true }
      });
      expect(chatStorageController.archiveConversation).toHaveBeenCalled();
    });
  });
}); 