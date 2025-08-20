import { vi } from 'vitest';

// Mock OpenAI client to avoid dangerouslyAllowBrowser error
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              function: {
                name: 'apply_yakukiho_rules',
                arguments: JSON.stringify({
                  modified: 'テスト用の修正されたテキスト',
                  violations: [],
                }),
              },
            }],
          },
        }],
      }),
    },
  },
  embeddings: {
    create: vi.fn().mockResolvedValue({
      data: [{
        embedding: new Array(384).fill(0.1),
      }],
    }),
  },
};

// Mock the ai-client module
export const createMockAIClient = () => ({
  createChatCompletion: vi.fn().mockResolvedValue({
    modified: 'テスト用の修正されたテキスト',
    violations: [],
  }),
  createEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
  getAIClientInfo: vi.fn().mockReturnValue({
    provider: 'mock',
    chatModel: 'mock-model',
    embeddingModel: 'mock-embedding-model',
  }),
  isUsingMock: vi.fn().mockReturnValue(true),
  hasValidApiKey: true,
});