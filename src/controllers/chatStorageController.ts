import { Request, Response } from 'express';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new chat conversation
 */
export const createConversation = async (req: Request, res: Response) => {
  try {
    const { user_id, title, product_context } = req.body;

    // Validate request
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: user_id is required'
      });
    }

    // Check if Supabase client is configured
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured. Chat storage is unavailable.'
      });
    }

    // Generate a default title if not provided
    const conversationTitle = title || `Conversation ${new Date().toLocaleDateString()}`;

    // Create the conversation
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        id: uuidv4(),
        user_id,
        title: conversationTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        product_context: product_context || null,
        is_archived: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in createConversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while creating the conversation'
    });
  }
};

/**
 * Add a message to an existing conversation
 */
export const addMessage = async (req: Request, res: Response) => {
  try {
    const { conversation_id, user_id, role, content, metadata } = req.body;
    
    // Validate request
    if (!conversation_id || !user_id || !role || !content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: conversation_id, user_id, role, and content are required'
      });
    }

    // Check if Supabase client is configured
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured. Chat storage is unavailable.'
      });
    }

    // Add the message
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        id: uuidv4(),
        conversation_id,
        user_id,
        role,
        content,
        created_at: new Date().toISOString(),
        metadata
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('Error adding message:', messageError);
      return res.status(500).json({
        success: false,
        error: messageError.message
      });
    }

    // Update the conversation's last_message_preview and updated_at
    const previewContent = content.length > 100 ? content.substring(0, 97) + '...' : content;
    const { error: updateError } = await supabase
      .from('chat_conversations')
      .update({
        last_message_preview: previewContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);
    
    if (updateError) {
      console.error('Error updating conversation preview:', updateError);
      // We'll still return a success for the message, even if updating the preview fails
    }

    return res.status(201).json({
      success: true,
      data: messageData
    });
  } catch (error: any) {
    console.error('Error in addMessage:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while adding the message'
    });
  }
};

/**
 * Get all conversations for a user
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const user_id = req.params.userId;
    
    // Validate request
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: userId is required'
      });
    }

    // Check if Supabase client is configured
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured. Chat storage is unavailable.'
      });
    }

    // Get all conversations for the user, ordered by most recent update
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error getting conversations:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in getConversations:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while getting conversations'
    });
  }
};

/**
 * Get all messages for a conversation
 */
export const getMessages = async (req: Request, res: Response) => {
  try {
    const conversation_id = req.params.conversationId;
    
    // Validate request
    if (!conversation_id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: conversationId is required'
      });
    }

    // Check if Supabase client is configured
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured. Chat storage is unavailable.'
      });
    }

    // Get all messages for the conversation, ordered by creation time
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error getting messages:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in getMessages:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while getting messages'
    });
  }
};

/**
 * Archive a conversation (soft delete)
 */
export const archiveConversation = async (req: Request, res: Response) => {
  try {
    const conversation_id = req.params.conversationId;
    
    // Validate request
    if (!conversation_id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: conversationId is required'
      });
    }

    // Check if Supabase client is configured
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured. Chat storage is unavailable.'
      });
    }

    // Archive the conversation (soft delete)
    const { error } = await supabase
      .from('chat_conversations')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);
    
    if (error) {
      console.error('Error archiving conversation:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error: any) {
    console.error('Error in archiveConversation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while archiving the conversation'
    });
  }
}; 