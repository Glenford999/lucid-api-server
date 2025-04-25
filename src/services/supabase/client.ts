import { createClient } from '@supabase/supabase-js';
import config from '../../config/config';

// Database types (simplified)
export type Database = {
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          last_message_preview: string | null;
          product_context: any | null;
          is_archived: boolean;
          metadata: any | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_message_preview?: string | null;
          product_context?: any | null;
          is_archived?: boolean;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_message_preview?: string | null;
          product_context?: any | null;
          is_archived?: boolean;
          metadata?: any | null;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content: string;
          created_at: string;
          metadata: any | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content: string;
          created_at?: string;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
          metadata?: any | null;
        };
      };
    };
  };
};

// Initialize supabase client
let supabase: ReturnType<typeof createClient<Database>> | null = null;

try {
  if (config.supabase.url && config.supabase.serviceRoleKey) {
    supabase = createClient<Database>(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    console.log('Supabase client initialized successfully');
  } else {
    console.warn('Supabase credentials not provided. Chat storage features will be unavailable.');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

export { supabase };

/**
 * Check if the Supabase client is properly configured
 * @returns True if the client is initialized, false otherwise
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
} 