import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock OpenAI client before importing ai-client
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    },
    embeddings: {
      create: vi.fn()
    }
  }))
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocking
import { createChatCompletion, createEmbedding } from '../ai-client'

describe('AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set test environment to avoid mock mode
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    vi.stubEnv('USE_LM_STUDIO', 'false')
    vi.stubEnv('LM_STUDIO_BASE_URL', 'http://localhost:1234/v1')
    vi.stubEnv('LM_STUDIO_API_KEY', 'lm-studio')
    vi.stubEnv('LM_STUDIO_CHAT_MODEL', 'test-model')
    vi.stubEnv('LM_STUDIO_EMBEDDING_MODEL', 'test-embedding-model')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createChatCompletion', () => {
    describe('Test mode', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'test')
      })

      it('should return mock response in test mode', async () => {
        const result = await createChatCompletion({
          messages: [
            { role: 'user', content: 'Test message' }
          ]
        })

        expect(result).toEqual({
          id: 'mock-chat-completion',
          object: 'chat.completion',
          created: expect.any(Number),
          model: 'mock-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: expect.any(String)
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        })

        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should return mock function call response in test mode', async () => {
        const functions = [{
          name: 'check_text',
          description: 'Check text for violations',
          parameters: {
            type: 'object',
            properties: {
              violations: {
                type: 'array',
                items: { type: 'object' }
              }
            }
          }
        }]

        const result = await createChatCompletion({
          messages: [
            { role: 'user', content: 'Check this text' }
          ],
          tools: functions.map(fn => ({
            type: 'function',
            function: fn
          }))
        })

        expect(result).toEqual({
          id: 'mock-chat-completion',
          object: 'chat.completion',
          created: expect.any(Number),
          model: 'mock-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_mock',
                type: 'function',
                function: {
                  name: 'apply_yakukiho_rules',
                  arguments: expect.any(String)
                }
              }]
            },
            finish_reason: 'tool_calls'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        })
      })
    })
  })

  describe('createEmbedding', () => {
    describe('Test mode', () => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'test')
      })

      it('should return mock embedding in test mode', async () => {
        const result = await createEmbedding('Test text')

        expect(result).toEqual(expect.any(Array))
        expect(result).toHaveLength(384)
        expect(result.every(val => typeof val === 'number')).toBe(true)

        expect(mockFetch).not.toHaveBeenCalled()
      })
    })
  })
})
