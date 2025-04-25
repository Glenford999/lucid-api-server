/// <reference types="jest" />

// Setup environment variables
process.env.NODE_ENV = 'test';

// Global mocks

// Mock for Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    data: [],
    error: null,
  };

  return {
    createClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };
});

// Mock for OpenAI client
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked OpenAI response',
                  role: 'assistant',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        },
      },
    })),
  };
});

// Mock for axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  create: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  })),
}));

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 