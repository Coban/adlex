import OpenAI from 'openai'

// Environment detection
const isProduction = process.env.NODE_ENV === 'production'
const isMockMode = process.env.OPENAI_API_KEY === 'mock'
const hasValidOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here' && !isMockMode

// AI client configuration
// Use LM Studio for local development, OpenAI for production, Mock for testing
const USE_LM_STUDIO = !isProduction && process.env.USE_LM_STUDIO === 'true'
const USE_MOCK = isMockMode || (!hasValidOpenAIKey && !USE_LM_STUDIO)

console.log('AI Client Configuration:', {
  isProduction,
  hasValidOpenAIKey,
  USE_LM_STUDIO,
  USE_MOCK,
  isMockMode,
  environment: process.env.NODE_ENV
})

// OpenAI client (for production)
const openaiClient = hasValidOpenAIKey ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
}) : null

// LM Studio client (for local development)
const lmStudioClient = new OpenAI({
  baseURL: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
  apiKey: process.env.LM_STUDIO_API_KEY ?? 'lm-studio',
})

// Select the appropriate client
export const aiClient = USE_LM_STUDIO ? lmStudioClient : openaiClient

// Model configurations
export const AI_MODELS = {
  chat: USE_LM_STUDIO 
    ? (process.env.LM_STUDIO_CHAT_MODEL ?? 'gemma-3-27b-it')
    : 'gpt-4o',
  embedding: USE_LM_STUDIO 
    ? (process.env.LM_STUDIO_EMBEDDING_MODEL ?? 'text-embedding-nomic-embed-text-v1.5')
    : 'text-embedding-3-small'
}

// Utility function to create chat completion
export async function createChatCompletion(params: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
  temperature?: number
  max_tokens?: number
}) {
  if (!aiClient) {
    throw new Error('AI client is not available. Please check your configuration.')
  }

  try {
    console.log(`Creating chat completion with model: ${AI_MODELS.chat}`)
    console.log(`Using ${USE_LM_STUDIO ? 'LM Studio' : 'OpenAI'} client`)
    
    // For LM Studio, simplify parameters and avoid unsupported features
    if (USE_LM_STUDIO) {
      const lmParams = {
        model: AI_MODELS.chat,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
        // LM Studio may not support tools/tool_choice, so omit them
      }
      
      const response = await aiClient.chat.completions.create(lmParams)
      console.log('LM Studio chat completion successful')
      return response
    }
    
    // For OpenAI, use full parameters
    const response = await aiClient.chat.completions.create({
      model: AI_MODELS.chat,
      ...params,
    })
    console.log('OpenAI chat completion successful')
    console.log('Response structure:', {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length,
      firstChoice: response.choices?.[0] ? {
        hasMessage: !!response.choices[0].message,
        messageKeys: response.choices[0].message ? Object.keys(response.choices[0].message) : []
      } : null
    })
    return response
  } catch (error) {
    console.error('Error in createChatCompletion:', error)
    throw new Error(`Failed to create chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to create embeddings
export async function createEmbedding(input: string): Promise<number[]> {
  if (!aiClient) {
    throw new Error('AI client is not available. Please check your configuration.')
  }

  try {
    console.log(`Creating embedding with model: ${AI_MODELS.embedding}`)
    console.log(`Input length: ${input.length} characters`)
    console.log(`Using ${USE_LM_STUDIO ? 'LM Studio' : 'OpenAI'} client`)
    
    // For LM Studio, use direct fetch to avoid OpenAI SDK parsing issues
    if (USE_LM_STUDIO) {
      const response = await fetch(`${process.env.LM_STUDIO_BASE_URL ?? 'http://127.0.0.1:1234/v1'}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY ?? 'lm-studio'}`
        },
        body: JSON.stringify({
          model: AI_MODELS.embedding,
          input,
        })
      })
      
      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('LM Studio embedding response:', {
        object: data.object,
        model: data.model,
        dataLength: data.data?.length,
        hasEmbedding: data.data?.[0]?.embedding ? 'yes' : 'no',
        embeddingLength: data.data?.[0]?.embedding?.length
      })
      
      if (data.data && data.data.length > 0 && data.data[0]?.embedding) {
        console.log('LM Studio embedding successful, vector length:', data.data[0].embedding.length)
        return data.data[0].embedding
      }
      
      throw new Error('LM Studio embedding response is missing data')
    }
    
    // For OpenAI, use the SDK
    const response = await aiClient.embeddings.create({
      model: AI_MODELS.embedding,
      input,
    })
    
    console.log('OpenAI embedding response:', {
      object: response.object,
      model: response.model,
      dataLength: response.data?.length,
      hasEmbedding: response.data?.[0]?.embedding ? 'yes' : 'no',
      embeddingLength: response.data?.[0]?.embedding?.length
    })

    if (!response.data || response.data.length === 0) {
      console.error('No data array in response:', response)
      throw new Error('No embedding data returned from OpenAI API')
    }
    
    if (!response.data[0]) {
      console.error('No first item in data array:', response.data)
      throw new Error('Embedding data array is empty')
    }

    if (!response.data[0].embedding) {
      console.error('No embedding in first item:', response.data[0])
      throw new Error('Embedding data is missing from response')
    }
    
    console.log('OpenAI embedding creation successful, vector length:', response.data[0].embedding.length)
    return response.data[0].embedding
  } catch (error) {
    console.error('Error in createEmbedding:', error)
    
    if (USE_LM_STUDIO) {
      throw new Error(`LM Studio embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check if LM Studio is running and the embedding model is loaded.`)
    }
    
    throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to check if we're using LM Studio
export function isUsingLMStudio(): boolean {
  return USE_LM_STUDIO
}

// Get embedding dimension based on the model being used
export function getEmbeddingDimension(): number {
  if (USE_LM_STUDIO) {
    // text-embedding-nomic-embed-text-v1.5 は768次元を使用
    return 768
  } else {
    return 1536 // OpenAI text-embedding-3-small
  }
}
