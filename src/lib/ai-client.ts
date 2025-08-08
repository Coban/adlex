import OpenAI from 'openai'

// Environment detection
const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isMockMode = process.env.OPENAI_API_KEY === 'mock' || isTest
const hasValidOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here' && !isMockMode

// AI client configuration
// Use LM Studio for local development, OpenAI for production, Mock for testing
const USE_LM_STUDIO = !isProduction && !isTest && process.env.USE_LM_STUDIO === 'true'
const USE_MOCK = isMockMode

// AI Client Configuration logged only in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log('AI Client Configuration:', {
      isProduction,
      isTest,
      hasValidOpenAIKey,
      USE_LM_STUDIO,
      USE_MOCK,
      isMockMode,
      environment: process.env.NODE_ENV,
      openai_api_key: process.env.OPENAI_API_KEY?.substring(0, 10)?.concat('...'),
      lm_studio_chat_model: process.env.LM_STUDIO_CHAT_MODEL,
      lm_studio_embedding_model: process.env.LM_STUDIO_EMBEDDING_MODEL,
      lm_studio_base_url: process.env.LM_STUDIO_BASE_URL
    })
  }

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

// Model configurations with validation
const getChatModel = () => {
  if (!USE_LM_STUDIO) return 'gpt-4o'
  
  const chatModel = process.env.LM_STUDIO_CHAT_MODEL ?? 'microsoft/Phi-3-mini-4k-instruct-gguf'
  
  // Prevent using embedding models for chat
  if (chatModel.includes('embedding') || chatModel.includes('embed')) {
    console.warn(`Warning: Chat model "${chatModel}" appears to be an embedding model. Using default chat model.`)
    return 'microsoft/Phi-3-mini-4k-instruct-gguf'
  }
  
  return chatModel
}

const getEmbeddingModel = () => {
  if (!USE_LM_STUDIO) return 'text-embedding-3-small'
  
  return process.env.LM_STUDIO_EMBEDDING_MODEL ?? 'text-embedding-nomic-embed-text-v1.5'
}

export const AI_MODELS = {
  chat: getChatModel(),
  embedding: getEmbeddingModel()
}

// Basic utility to sanitize plain text from model outputs (strip code fences)
function sanitizePlainText(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  // Remove ``` blocks if present
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/)
  if (fenced?.[1]) return fenced[1].trim()
  return trimmed
}

// Utility function to create chat completion
/**
 * AIクライアントを使用してチャット完了を作成する
 * OpenAIまたはLM Studioのクライアントを使用してLLMとの対話を行う
 * @param params チャット完了のパラメータ（メッセージ、ツール、設定など）
 * @returns チャット完了のレスポンス
 */
export async function createChatCompletion(params: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
  temperature?: number
  max_tokens?: number
}) {
  // テスト/モックモードの場合はモックレスポンスを返す
  if (USE_MOCK) {
    // ファンクション呼び出しリクエストかどうかをチェック
    if (params.tools && params.tools.length > 0) {
      // ファンクション呼び出しレスポンスを返す
      return {
        id: 'mock-chat-completion',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'mock-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: null,
            tool_calls: [{
              id: 'call_mock',
              type: 'function' as const,
              function: {
                name: 'apply_yakukiho_rules',
                arguments: JSON.stringify({
                  modified: "このサプリメントは健康維持にお役立ていただけます。血圧の健康維持をサポートします。",
                  violations: [
                    {
                      start: 0,
                      end: 4,
                      reason: "医薬品的効能効果表現: がん治療効果の標榜は薬機法違反です",
                      dictionaryId: 1
                    },
                    {
                      start: 28,
                      end: 35,
                      reason: "医薬品的効能効果表現: 血圧降下効果は医薬品的効果に該当します",
                      dictionaryId: 3
                    }
                  ]
                })
              }
            }]
          },
          finish_reason: 'tool_calls' as const
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    } else {
      // 通常のコンテンツレスポンスを返す
      return {
        id: 'mock-chat-completion',
        object: 'chat.completion' as const,
        created: Date.now(),
        model: 'mock-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              modified: "このサプリメントは健康維持にお役立ていただけます。血圧の健康維持をサポートします。",
              violations: [
                {
                  start: 0,
                  end: 4,
                  reason: "医薬品的効能効果表現: がん治療効果の標榜は薬機法違反です",
                  dictionaryId: 1
                },
                {
                  start: 28,
                  end: 35,
                  reason: "医薬品的効能効果表現: 血圧降下効果は医薬品的効果に該当します",
                  dictionaryId: 3
                }
              ]
            })
          },
          finish_reason: 'stop' as const
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    }
  }

  if (!aiClient) {
    throw new Error('AI client is not available. Please check your configuration.')
  }

  try {
    // LM Studio用のパラメータ簡略化（サポートされていない機能を回避）
    if (USE_LM_STUDIO) {
      const lmParams = {
        model: AI_MODELS.chat,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
        // LM Studioはtools/tool_choiceをサポートしていない可能性があるため除外
      }
      
      console.log('LM Studio chat completion request with model:', AI_MODELS.chat)
      
      // LM Studioリクエスト用のタイムアウト処理を追加
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LM Studio chat completion timed out (90 seconds)')), 90000)
      })
      
      const chatPromise = aiClient.chat.completions.create(lmParams)
      
      try {
        const response = await Promise.race([chatPromise, timeoutPromise])
        console.log('LM Studio chat completion successful')
        return response
      } catch (error) {
        console.error('LM Studio specific error:', error)
        
        if (error instanceof Error) {
          // LM Studioの一般的なモデル関連エラーを処理
          if (error.message.includes('Failed to load model') && error.message.includes('not llm')) {
            throw new Error(`LM Studio model error: "${AI_MODELS.chat}" is not a chat/LLM model. Please load a chat model in LM Studio (e.g., microsoft/Phi-3-mini-4k-instruct-gguf, google/gemma-2-2b-it-gguf). Current model appears to be an embedding model. Check /api/debug/model-validation for configuration help.`)
          }
          if (error.message.includes('model') && error.message.includes('not found')) {
            throw new Error(`LM Studio model not found: ${AI_MODELS.chat}. Please ensure this model is loaded in LM Studio. Check /api/debug/model-validation for available models.`)
          }
          if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
            throw new Error('LM Studio is not running or not accessible. Please start LM Studio and load a chat model. Check /api/debug/model-validation for connection status.')
          }
          if (error.message.includes('timed out')) {
            throw new Error('LM Studio request timed out. The model may be overloaded or the request too complex.')
          }
          if (error.message.includes('404')) {
            throw new Error(`LM Studio 404 error: Model "${AI_MODELS.chat}" not found or not properly loaded. Please check LM Studio and ensure a chat model is loaded. Check /api/debug/model-validation for configuration help.`)
          }
        }
        
        throw new Error(`LM Studio chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // OpenAI用の完全なパラメータを使用
    const response = await aiClient.chat.completions.create({
      model: AI_MODELS.chat,
      ...params,
    })
    return response
  } catch (error) {
    console.error('Error in createChatCompletion:', error)
    
    // デバッグ用の詳細なエラー情報をログに出力
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        currentModel: AI_MODELS.chat,
        usingLMStudio: USE_LM_STUDIO,
        hasValidOpenAIKey,
        aiClientAvailable: !!aiClient
      })
    }
    
    throw new Error(`Failed to create chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract text from an image using an LLM with vision capability.
 * - Production: OpenAI (gpt-4o)
 * - Development: LM Studio if available; may not support vision → throws with guidance
 */
/**
 * LLMを使用して画像からテキストを抽出する（OCR処理）
 * LM StudioまたはOpenAIのVision機能を使用
 * @param imageUrl 処理対象の画像URL
 * @returns 抽出されたテキストと使用されたプロバイダー情報
 */
export async function extractTextFromImageWithLLM(imageUrl: string): Promise<{
  text: string
  provider: 'openai' | 'lmstudio'
  model: string
}> {
  // 本番環境ではOpenAIを優先、開発環境ではUSE_LM_STUDIOフラグに従う
  // ただし、LM StudioがVision対応でない場合は明確なエラーを表示

  // マルチモーダル用のユーザーコンテンツを構築
  const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string }> = [
    { type: 'input_text', text: '以下の画像に写っているすべての文字列を読み取り、読み順に沿って日本語で忠実に出力してください。装飾記号は必要に応じて省略して構いません。出力は純粋なテキストのみとし、説明や前置きは不要です。' },
    { type: 'input_image', image_url: imageUrl }
  ]

  // 開発環境でLM Studioが設定されている場合は最初に試行
  if (isUsingLMStudio()) {
    try {
      const response: unknown = await createChatCompletion({
        messages: [
          { role: 'system', content: 'あなたはOCRエンジンです。画像内の文字を正確に読み取り、プレーンテキストとして返します。' },
          { role: 'user', content: userContent as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart[] }
        ],
        temperature: 0,
        max_tokens: 4000
      })

      const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('LM Studio did not return textual content for vision request')
      }
      return {
        text: sanitizePlainText(content),
        provider: 'lmstudio',
        model: AI_MODELS.chat
      }
    } catch (error) {
      // モデルがVision機能をサポートしていない場合の分かりやすいエラーメッセージ
      if (error instanceof Error && (
        error.message.includes('image') ||
        error.message.toLowerCase().includes('vision') ||
        error.message.includes('not supported') ||
        error.message.includes('unsupported')
      )) {
        throw new Error('LM Studioの現在のモデルは画像入力（Vision）をサポートしていません。Vision対応のモデルをロードするか、本番同等のOpenAI環境で実行してください。')
      }
      throw error
    }
  }

  // フォールバック / 本番パス：OpenAI GPT-4o
  if (!openaiClient) {
    throw new Error('OpenAIクライアントが利用できません。OPENAI_API_KEY を設定するか LM Studio をVision対応モデルで起動してください。')
  }

  const response = await openaiClient.chat.completions.create({
    model: AI_MODELS.chat,
    messages: [
      { role: 'system', content: 'あなたはOCRエンジンです。画像内の文字を正確に読み取り、プレーンテキストとして返します。可能であれば段落・改行を保ち、ノイズを除去して出力してください。' },
      { role: 'user', content: userContent as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart[] }
    ],
    temperature: 0,
    max_tokens: 4000
  })

  const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI応答にテキストが含まれていません')
  }
  return {
    text: sanitizePlainText(content),
    provider: 'openai',
    model: AI_MODELS.chat
  }
}

// Heuristic score for OCR quality (length / unique chars / presence of mojibake)
/**
 * OCR結果テキストの簡易信頼度を 0.0〜1.0 で推定するヒューリスティック関数。
 *
 * 評価項目:
 * - 長さスコア: 文字数/50 を上限1.0でクリップ（極端に短い結果は低信頼）
 * - 多様性スコア: 空白除去後のユニーク文字数/20 を上限1.0でクリップ（単調な繰り返しを低信頼）
 * - モジバケ系ペナルティ: 置換文字 '�' や U+FFFD の検出で減点
 *
 * 合成方法:
 *   score = clamp01( 0.5*長さ + 0.5*多様性 - ペナルティ ) を小数第2位で丸めて返します。
 *
 * 目的: 厳密な品質指標ではなく、UIでの注意喚起や再撮影の推奨に使う軽量指標です。
 */
/**
 * OCR結果テキストの信頼度を推定する
 * テキストの長さ、文字の多様性、文字化けの有無などから算出
 * @param text OCR処理されたテキスト
 * @returns 0.0-1.0の範囲の信頼度スコア
 */
export function estimateOcrConfidence(text: string): number {
  // テキスト長に基づくスコア（最大50文字で1.0）
  const lengthScore = Math.min(1, text.length / 50)
  
  // 一意文字数に基づくスコア（最大20文字で1.0）
  const uniqueChars = new Set(text.replace(/\s/g, '').split(''))
  const uniqueScore = Math.min(1, uniqueChars.size / 20)
  
  // 文字化け文字によるペナルティ
  const mojibakePenalty = /\ufffd|\ufffd/.test(text) ? 0.3 : 0
  
  // 句読点異常によるペナルティ
  const punctuationPenalty = (text.match(/[\uFFFD]/g)?.length ?? 0) > 0 ? 0.2 : 0
  
  // 最終スコア算出（0.0-1.0の範囲で制限）
  const score = Math.max(0, Math.min(1, 0.5 * lengthScore + 0.5 * uniqueScore - mojibakePenalty - punctuationPenalty))
  return Number(score.toFixed(2))
}

// Utility function to create embeddings
/**
 * テキストの埋め込みベクトルを生成する
 * 辞書エントリの類似性検索に使用される
 * @param input 埋め込みベクトルを生成するテキスト
 * @returns 埋め込みベクトルの数値配列
 */
export async function createEmbedding(input: string): Promise<number[]> {
  // テスト/モックモードでは模擬埋め込みを返す
  if (USE_MOCK) {
    console.log('辞書項目のembedding生成を開始:', input)
    const mockEmbedding = new Array(384).fill(0).map(() => Math.random() - 0.5)
    console.log('Embedding生成成功, 次元数:', mockEmbedding.length)
    return mockEmbedding
  }

  if (!aiClient) {
    throw new Error('AI client is not available. Please check your configuration.')
  }

  try {
    // LM Studio用：OpenAI SDKのパース問題を回避するため直接fetchを使用
    if (USE_LM_STUDIO) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒タイムアウト
      
      try {
        const response = await fetch(`${process.env.LM_STUDIO_BASE_URL ?? 'http://127.0.0.1:1234/v1'}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY ?? 'lm-studio'}`
          },
          body: JSON.stringify({
            model: AI_MODELS.embedding,
            input,
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (data.data && data.data.length > 0 && data.data[0]?.embedding) {
          return data.data[0].embedding
        }
        
        throw new Error('LM Studio embedding response is missing data')
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('LM Studio embedding request timed out (60 seconds)')
        }
        throw error
      }
    }
    
    // OpenAI用：SDKを使用
    const response = await aiClient.embeddings.create({
      model: AI_MODELS.embedding,
      input,
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

// Additional utility functions for debugging and monitoring
export function getCurrentAIModel(): string {
  return AI_MODELS.chat
}

export function getAIClientInfo() {
  return {
    isUsingLMStudio: USE_LM_STUDIO,
    currentChatModel: AI_MODELS.chat,
    currentEmbeddingModel: AI_MODELS.embedding,
    hasValidOpenAIKey,
    clientAvailable: !!aiClient,
    environment: process.env.NODE_ENV,
    isMockMode: USE_MOCK,
    lmStudioChatModelEnv: process.env.LM_STUDIO_CHAT_MODEL,
    lmStudioEmbeddingModelEnv: process.env.LM_STUDIO_EMBEDDING_MODEL,
    lmStudioBaseUrl: process.env.LM_STUDIO_BASE_URL
  }
}

// Function to validate and suggest model configurations
export function validateModelConfiguration() {
  const issues = []
  const suggestions = []
  
  if (USE_LM_STUDIO) {
    const chatModel = AI_MODELS.chat
    const embeddingModel = AI_MODELS.embedding
    
    // Check if chat model looks like an embedding model
    if (chatModel.includes('embedding') || chatModel.includes('embed')) {
      issues.push(`Chat model "${chatModel}" appears to be an embedding model`)
      suggestions.push('Set LM_STUDIO_CHAT_MODEL to a proper chat model like "microsoft/Phi-3-mini-4k-instruct-gguf"')
    }
    
    // Check if embedding model looks like a chat model
    if (!embeddingModel.includes('embedding') && !embeddingModel.includes('embed')) {
      issues.push(`Embedding model "${embeddingModel}" might not be an embedding model`)
      suggestions.push('Set LM_STUDIO_EMBEDDING_MODEL to a proper embedding model like "text-embedding-nomic-embed-text-v1.5"')
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    currentConfig: getAIClientInfo()
  }
}

// Utility function to check if we're using mock mode
export function isUsingMock(): boolean {
  return USE_MOCK
}

// Get embedding dimension based on the model being used
export function getEmbeddingDimension(): number {
  if (USE_MOCK) {
    return 384 // Mock embedding dimension
  } else if (USE_LM_STUDIO) {
    // text-embedding-nomic-embed-text-v1.5 は768次元を使用
    return 768
  } else {
    return 1536 // OpenAI text-embedding-3-small
  }
}

// Legacy createChatCompletion for check-processor compatibility  
type DictionaryEntry = {
  id: number
  phrase: string
  category: string
  similarity?: number
}

type ViolationData = {
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
}

export async function createChatCompletionForCheck(text: string, relevantEntries: DictionaryEntry[]): Promise<{
  type: 'openai' | 'lmstudio'
  response?: OpenAI.Chat.Completions.ChatCompletion
  violations: ViolationData[]
  modified: string
}> {

  const messages = [
    {
      role: 'system' as const,
      content: `あなたは薬機法コンプライアンスの専門家です。与えられた広告テキストを分析し、薬機法違反の可能性がある表現を特定して修正してください。

以下の辞書項目を参考に、テキスト内の違反箇所を特定し、適切な表現に修正してください：

辞書項目:
${relevantEntries.map(entry => `- "${entry.phrase}" (類似度: ${(entry.similarity ?? 0).toFixed(2)})`).join('\n')}

分析結果は以下のJSON形式で返してください：
{
  "modified": "修正されたテキスト",
  "violations": [
    {
      "start_pos": 開始位置,
      "end_pos": 終了位置,
      "reason": "違反理由",
      "dictionary_id": 辞書項目ID（該当する場合）
    }
  ]
}`
    },
    {
      role: 'user' as const,
      content: text
    }
  ]

  if (USE_LM_STUDIO) {
    // LM Studio mode - parse JSON from content
    const response = await createChatCompletion({
      messages,
      temperature: 0.1,
      max_tokens: 2000
    })

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LM Studio did not return content')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in LM Studio response')
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.modified || typeof parsed.modified !== 'string') {
        throw new Error('Invalid modified field in response')
      }
      
      if (!Array.isArray(parsed.violations)) {
        throw new Error('Invalid violations field in response')
      }

      return {
        type: 'lmstudio',
        violations: parsed.violations,
        modified: parsed.modified
      }
    } catch (error) {
      throw new Error(`Failed to parse LM Studio JSON response: ${error}`)
    }
  } else {
    // OpenAI mode - use function calling
    const tools = [{
      type: 'function' as const,
      function: {
        name: 'apply_yakukiho_rules',
        description: '薬機法ルールを適用してテキストを分析・修正する',
        parameters: {
          type: 'object',
          properties: {
            modified: {
              type: 'string',
              description: '薬機法に準拠するよう修正されたテキスト'
            },
            violations: {
              type: 'array',
              description: '検出された違反項目のリスト',
              items: {
                type: 'object',
                properties: {
                  start: { type: 'number', description: '違反箇所の開始位置' },
                  end: { type: 'number', description: '違反箇所の終了位置' },
                  reason: { type: 'string', description: '違反理由' },
                  dictionaryId: { type: 'number', description: '対応する辞書項目ID' }
                },
                required: ['start', 'end', 'reason']
              }
            }
          },
          required: ['modified', 'violations']
        }
      }
    }]

    const response = await createChatCompletion({
      messages,
      tools,
      tool_choice: { type: 'function', function: { name: 'apply_yakukiho_rules' } },
      temperature: 0.1,
      max_tokens: 2000
    })

    return {
      type: 'openai',
      response: response as OpenAI.Chat.Completions.ChatCompletion,
      violations: [], // Will be extracted by caller
      modified: '' // Will be extracted by caller
    }
  }
}
