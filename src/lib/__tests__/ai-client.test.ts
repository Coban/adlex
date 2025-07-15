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

import { createChatCompletion, createEmbedding } from '../ai-client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe.skip('AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.USE_LM_STUDIO = 'false'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.LM_STUDIO_BASE_URL = 'http://localhost:1234/v1'
    process.env.LM_STUDIO_API_KEY = 'lm-studio'
    process.env.LM_STUDIO_CHAT_MODEL = 'test-model'
    process.env.LM_STUDIO_EMBEDDING_MODEL = 'test-embedding-model'
    
    // Mock browser environment to avoid "not in browser" error
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost'
        }
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createChatCompletion', () => {
    describe('OpenAI mode', () => {
      it('should create chat completion with OpenAI', async () => {
        const mockResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: 'Test response'
            }
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await createChatCompletion([
          { role: 'user', content: 'Test message' }
        ])

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-openai-key'
            },
            body: expect.stringContaining('Test message')
          })
        )

        expect(result).toEqual(mockResponse)
      })

      it('should handle function calling with OpenAI', async () => {
        const mockResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              function_call: {
                name: 'check_text',
                arguments: '{"violations": []}'
              }
            }
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

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

        const result = await createChatCompletion([
          { role: 'user', content: 'Check this text' }
        ], { functions })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            body: expect.stringContaining('check_text')
          })
        )

        expect(result).toEqual(mockResponse)
      })

      it('should handle OpenAI API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            error: {
              message: 'Invalid API key'
            }
          })
        })

        await expect(createChatCompletion([
          { role: 'user', content: 'Test' }
        ])).rejects.toThrow('OpenAI API Error: Invalid API key')
      })
    })

    describe('LM Studio mode', () => {
      beforeEach(() => {
        process.env.USE_LM_STUDIO = 'true'
      })

      it('should create chat completion with LM Studio', async () => {
        const mockResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: 'Test response'
            }
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await createChatCompletion([
          { role: 'user', content: 'Test message' }
        ])

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:1234/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer lm-studio'
            },
            body: expect.stringContaining('test-model')
          })
        )

        expect(result).toEqual(mockResponse)
      })

      it('should handle LM Studio function calling simulation', async () => {
        const mockResponse = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: '{"violations": [{"start_pos": 0, "end_pos": 10, "reason": "Test violation"}]}'
            }
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

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

        const result = await createChatCompletion([
          { role: 'user', content: 'Check this text' }
        ], { functions })

        expect(result).toEqual(mockResponse)
      })

      it('should handle LM Studio API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            error: {
              message: 'Internal server error'
            }
          })
        })

        await expect(createChatCompletion([
          { role: 'user', content: 'Test' }
        ])).rejects.toThrow('LM Studio API Error: Internal server error')
      })
    })

    describe('Test mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test'
      })

      it('should return mock response in test mode', async () => {
        const result = await createChatCompletion([
          { role: 'user', content: 'Test message' }
        ])

        expect(result).toEqual({
          id: 'test-completion',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: 'Mock response for testing'
            }
          }]
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

        const result = await createChatCompletion([
          { role: 'user', content: 'Check this text' }
        ], { functions })

        expect(result).toEqual({
          id: 'test-completion',
          object: 'chat.completion',
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              function_call: {
                name: 'check_text',
                arguments: JSON.stringify({
                  violations: [{
                    start_pos: 0,
                    end_pos: 10,
                    reason: 'Mock violation for testing'
                  }]
                })
              }
            }
          }]
        })
      })
    })
  })

  describe('createEmbedding', () => {
    describe('OpenAI mode', () => {
      it('should create embeddings with OpenAI', async () => {
        const mockResponse = {
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await createEmbedding('Test text')

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/embeddings',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-openai-key'
            },
            body: expect.stringContaining('Test text')
          })
        )

        expect(result).toEqual(mockResponse)
      })

      it('should handle OpenAI embedding API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: {
              message: 'Invalid input'
            }
          })
        })

        await expect(createEmbedding('Test text')).rejects.toThrow('OpenAI API Error: Invalid input')
      })
    })

    describe('LM Studio mode', () => {
      beforeEach(() => {
        process.env.USE_LM_STUDIO = 'true'
      })

      it('should create embeddings with LM Studio', async () => {
        const mockResponse = {
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0
          }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await createEmbedding('Test text')

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:1234/v1/embeddings',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer lm-studio'
            },
            body: expect.stringContaining('test-embedding-model')
          })
        )

        expect(result).toEqual(mockResponse)
      })

      it('should handle LM Studio embedding API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            error: {
              message: 'Model not loaded'
            }
          })
        })

        await expect(createEmbedding('Test text')).rejects.toThrow('LM Studio API Error: Model not loaded')
      })
    })

    describe('Test mode', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test'
      })

      it('should return mock embedding in test mode', async () => {
        const result = await createEmbedding('Test text')

        expect(result).toEqual({
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: new Array(1536).fill(0.1),
            index: 0
          }]
        })

        expect(mockFetch).not.toHaveBeenCalled()
      })
    })
  })

  describe('Configuration validation', () => {
    it('should throw error if OpenAI API key is missing', async () => {
      delete process.env.OPENAI_API_KEY
      process.env.USE_LM_STUDIO = 'false'

      await expect(createChatCompletion([
        { role: 'user', content: 'Test' }
      ])).rejects.toThrow('OpenAI API key is required')
    })

    it('should throw error if LM Studio configuration is missing', async () => {
      delete process.env.LM_STUDIO_BASE_URL
      process.env.USE_LM_STUDIO = 'true'

      await expect(createChatCompletion([
        { role: 'user', content: 'Test' }
      ])).rejects.toThrow('LM Studio configuration is required')
    })
  })

  describe('Network error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(createChatCompletion([
        { role: 'user', content: 'Test' }
      ])).rejects.toThrow('Network error')
    })

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      )

      await expect(createChatCompletion([
        { role: 'user', content: 'Test' }
      ])).rejects.toThrow('Request timeout')
    })
  })

  describe('Request formatting', () => {
    it('should format messages correctly for OpenAI', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Test response'
          }
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const messages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ]

      await createChatCompletion(messages)

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.messages).toEqual(messages)
      expect(requestBody.model).toBe('gpt-4o')
      expect(requestBody.temperature).toBe(0.1)
    })

    it('should format embedding request correctly', async () => {
      const mockResponse = {
        object: 'list',
        data: [{
          object: 'embedding',
          embedding: [0.1, 0.2, 0.3],
          index: 0
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      await createEmbedding('Test text')

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.input).toBe('Test text')
      expect(requestBody.model).toBe('text-embedding-3-small')
    })
  })
})