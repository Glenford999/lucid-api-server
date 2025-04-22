import { Request, Response } from 'express';
import * as chatStorageController from '../../controllers/chatStorageController';
import { supabase } from '../../services/supabase/client';

// Mock the supabase client
jest.mock('../../services/supabase/client', () => {
  const mockData = { id: 'mock-conversation-id' };
  
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(function(this: { data: any; error: any }) {
      return { data: this.data, error: this.error };
    }),
    data: null,
    error: null
  };

  return {
    supabase: mockSupabase,
    isSupabaseConfigured: jest.fn().mockReturnValue(true)
  };
});

describe('Chat Storage Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      body: {},
      params: {}
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock
    };
    
    // Reset the supabase mock data for each test
    (supabase as any).data = null;
    (supabase as any).error = null;
  });

  describe('createConversation', () => {
    it('should create a conversation successfully', async () => {
      // Setup the mock request
      mockRequest.body = {
        user_id: 'test-user',
        title: 'Test Conversation',
        product_context: { product_id: 'test-product' }
      };

      // Mock the Supabase response
      (supabase as any).data = { id: 'mock-conversation-id' };
      
      await chatStorageController.createConversation(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { id: 'mock-conversation-id' }
      });
    });

    it('should handle missing user_id', async () => {
      // Setup the mock request with missing user_id
      mockRequest.body = {
        title: 'Test Conversation'
      };
      
      await chatStorageController.createConversation(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('user_id is required')
        })
      );
    });

    it('should handle Supabase errors', async () => {
      // Setup the mock request
      mockRequest.body = {
        user_id: 'test-user',
        title: 'Test Conversation'
      };

      // Mock a Supabase error
      (supabase as any).error = { message: 'Database error' };
      
      await chatStorageController.createConversation(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Database error')
        })
      );
    });
  });

  describe('addMessage', () => {
    it('should add a message successfully', async () => {
      // Setup the mock request
      mockRequest.body = {
        conversation_id: 'test-conversation',
        user_id: 'test-user',
        role: 'user',
        content: 'Hello world'
      };

      // Mock the Supabase response
      (supabase as any).data = { id: 'mock-message-id' };
      
      await chatStorageController.addMessage(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { id: 'mock-message-id' }
      });
    });

    it('should handle missing required fields', async () => {
      // Setup the mock request with missing fields
      mockRequest.body = {
        user_id: 'test-user',
        content: 'Hello world'
        // Missing conversation_id and role
      };
      
      await chatStorageController.addMessage(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('getConversations', () => {
    it('should get conversations for a user', async () => {
      // Setup the mock request
      mockRequest.params = {
        userId: 'test-user'
      };

      // Mock the Supabase response
      (supabase as any).data = [
        { id: 'conversation-1', title: 'First Conversation' },
        { id: 'conversation-2', title: 'Second Conversation' }
      ];
      
      await chatStorageController.getConversations(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 'conversation-1', title: 'First Conversation' },
          { id: 'conversation-2', title: 'Second Conversation' }
        ]
      });
    });

    it('should handle missing userId parameter', async () => {
      // Setup the mock request with missing userId
      mockRequest.params = {};
      
      await chatStorageController.getConversations(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('getMessages', () => {
    it('should get messages for a conversation', async () => {
      // Setup the mock request
      mockRequest.params = {
        conversationId: 'test-conversation'
      };

      // Mock the Supabase response
      (supabase as any).data = [
        { id: 'message-1', content: 'Hello' },
        { id: 'message-2', content: 'World' }
      ];
      
      await chatStorageController.getMessages(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [
          { id: 'message-1', content: 'Hello' },
          { id: 'message-2', content: 'World' }
        ]
      });
    });

    it('should handle missing conversationId parameter', async () => {
      // Setup the mock request with missing conversationId
      mockRequest.params = {};
      
      await chatStorageController.getMessages(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('archiveConversation', () => {
    it('should archive a conversation successfully', async () => {
      // Setup the mock request
      mockRequest.params = {
        conversationId: 'test-conversation'
      };

      // Mock the Supabase response
      (supabase as any).data = { 
        id: 'test-conversation', 
        is_archived: true 
      };
      
      await chatStorageController.archiveConversation(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Conversation archived successfully'
      });
    });

    it('should handle missing conversationId parameter', async () => {
      // Setup the mock request with missing conversationId
      mockRequest.params = {};
      
      await chatStorageController.archiveConversation(
        mockRequest as Request,
        mockResponse as Response
      );
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });
}); 