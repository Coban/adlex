import OpenAI from 'openai'

/**
 * テキストからネストしたJSONオブジェクトを抽出する堅牢な関数
 * 複数のレベルでネストしたオブジェクトと配列に対応
 */
function extractCompleteJSON(text: string): string | null {
  // 様々なJSON開始パターンを試す
  const patterns = [
    // 一般的なJSON開始位置
    /\{[\s\S]*?\}/g,
    // 「response」や「result」などのラベル後
    /(?:response|result|answer|json)[:=]\s*(\{[\s\S]*?\})/gi,
    // 行の開始から
    /^\s*(\{[\s\S]*?\})\s*$/gm,
    // 文中の任意の位置
    /(\{[\s\S]*?\})/g
  ]

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern))
    
    for (const match of matches) {
      const candidate = match[1] || match[0]
      if (!candidate) continue

      // カンディデートからJSONを抽出を試行
      try {
        // JSONを括弧の対応をチェックしながら抽出
        const completeJson = findBalancedBraces(candidate)
        if (completeJson) {
          JSON.parse(completeJson) // パースチェック
          return completeJson
        }
      } catch {
        // このカンディデートは無効、次を試す
        continue
      }
    }
  }

  return null
}

/**
 * バランスの取れた括弧を見つけてJSONオブジェクトを抽出
 */
function findBalancedBraces(text: string): string | null {
  const startIndex = text.indexOf('{')
  if (startIndex === -1) return null

  let braceCount = 0
  let inString = false
  let escapeNext = false

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          return text.substring(startIndex, i + 1)
        }
      }
    }
  }

  return null
}

/**
 * プレーンテキスト応答からJSONレスポンスを生成するフォールバック機能
 * LM Studio がJSON形式で応答しない場合に使用
 */
function generateJSONFromPlainText(originalText: string, plainTextResponse: string): string {
  console.log('[AI] Generating JSON from plain text response:', plainTextResponse)
  
  // プレーンテキスト応答を解析して意味のあるJSON構造を生成
  let modified = originalText
  const violations: Array<{start_pos: number, end_pos: number, reason: string, dictionary_id: null}> = []
  
  // パターン1: 「〜に変更してください」「〜に修正してください」のような指示文
  const instructionPatterns = [
    /(.+)(?:に変更|を修正|に置き換え|を|へ)(?:してください|すべき|する)/g,
    /(.+)などの表現に変更/g,
    /(.+)という表現/g
  ]
  
  for (const pattern of instructionPatterns) {
    const matches = Array.from(plainTextResponse.matchAll(pattern))
    if (matches.length > 0) {
      // 最初のマッチから修正案を取得
      const suggestion = matches[0][1]?.trim()
      if (suggestion) {
        modified = suggestion
        violations.push({
          start_pos: 0,
          end_pos: originalText.length,
          reason: `薬機法に抵触する表現のため修正が必要です: ${plainTextResponse}`,
          dictionary_id: null
        })
        break
      }
    }
  }
  
  // パターン2: 単純な置換提案（元テキストが短い場合）
  if (violations.length === 0 && originalText !== plainTextResponse && plainTextResponse.length < 100) {
    modified = plainTextResponse
    violations.push({
      start_pos: 0,
      end_pos: originalText.length,
      reason: '薬機法に適合する表現への修正提案',
      dictionary_id: null
    })
  }
  
  // パターン3: 元のテキストに問題がない場合（レスポンスが元テキストと同じ）
  if (originalText === plainTextResponse) {
    // 違反なしとして処理
    modified = originalText
  }
  
  const result = JSON.stringify({
    modified,
    violations
  })
  
  console.log('[AI] Generated JSON structure:', result)
  return result
}

// 環境検出
const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
// モックはテスト時のみ有効
const aiProvider = process.env.AI_PROVIDER ?? (isProduction ? 'openai' : 'lmstudio')
const hasValidApiKey = Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your-api-key')

// 古い環境変数との後方互換性
const legacyOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here'
const legacyOpenRouterKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your-openrouter-api-key'

// AIクライアント設定
const USE_MOCK = isTest

// プロバイダーベースのAPIキー取得（後方互換性付き）
function getApiKey(): string | null {
  if (process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your-api-key') {
    return process.env.AI_API_KEY
  }
  // 後方互換性
  if (aiProvider === 'openai' && legacyOpenAIKey) {
    return process.env.OPENAI_API_KEY!
  }
  if (aiProvider === 'openrouter' && legacyOpenRouterKey) {
    return process.env.OPENROUTER_API_KEY!
  }
  if (aiProvider === 'lmstudio') {
    return process.env.LM_STUDIO_API_KEY ?? 'lm-studio'
  }
  return null
}

// AIクライアント設定 - プロバイダーに基づいて初期化
const apiKey = getApiKey()

// OpenAIクライアント（チャット用）
const openaiClient = (aiProvider === 'openai' && apiKey) ? new OpenAI({
  apiKey: apiKey,
}) : null

// OpenAIクライアント（埋め込み用 - メインプロバイダーと独立して初期化）
// OPENAI_API_KEY が存在する場合、または AI_PROVIDER が openai で AI_API_KEY が設定されている場合に作成
let openaiEmbeddingClient: OpenAI | null = (() => {
  // OPENAI専用キー（推奨）
  const explicitOpenAIKey = legacyOpenAIKey ? process.env.OPENAI_API_KEY! : null
  // AI_PROVIDER が openai の場合は統一キーも利用可能
  const providerOpenAIKey = (aiProvider === 'openai' && apiKey) ? apiKey : null
  const key = explicitOpenAIKey ?? providerOpenAIKey
  return key ? new OpenAI({ apiKey: key }) : null
})()

// 埋め込み用のOpenAIクライアントをオンデマンドで初期化して取得
function ensureOpenAIEmbeddingClient(): OpenAI | null {
  if (openaiEmbeddingClient) return openaiEmbeddingClient

  // 優先: 明示的な OPENAI_API_KEY
  const openaiKey = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here')
    ? process.env.OPENAI_API_KEY!
    : null

  // 次点: メインプロバイダーが OpenAI の場合は AI_API_KEY
  const providerKey = (aiProvider === 'openai' && apiKey) ? apiKey : null

  const keyToUse = openaiKey ?? providerKey
  if (keyToUse) {
    openaiEmbeddingClient = new OpenAI({ apiKey: keyToUse })
    return openaiEmbeddingClient
  }

  return null
}

// OpenRouterクライアント
function getSanitizedReferer(): string {
  const fallback = 'http://localhost:3000'
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? fallback
  try {
    const url = new URL(raw)
    // http/https のみ許可し、クレデンシャル・パス等は含めず origin に固定
    if (!/^https?:$/.test(url.protocol)) return fallback
    const origin = url.origin
    // 長さを制限（ヘッダー肥大対策）
    return origin.length > 200 ? origin.slice(0, 200) : origin
  } catch {
    return fallback
  }
}

const openRouterClient = (aiProvider === 'openrouter' && apiKey) ? new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey,
  defaultHeaders: {
    'HTTP-Referer': getSanitizedReferer(),
    'X-Title': 'AdLex - Pharmaceutical Law Compliance Checker',
  },
}) : null

// LM Studioクライアント
const lmStudioClient = aiProvider === 'lmstudio' ? new OpenAI({
  baseURL: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
  apiKey: apiKey ?? 'lm-studio',
}) : null

// 適切なクライアントを選択
export const aiClient = aiProvider === 'lmstudio' ? lmStudioClient : aiProvider === 'openrouter' ? openRouterClient : openaiClient

// 埋め込みプロバイダー解決ヘルパー（重複回避のため集約）
type EmbeddingProvider = 'openai' | 'lmstudio' | 'auto'
function getEmbeddingProvider(): EmbeddingProvider {
  if (aiProvider === 'openrouter') {
    const value = (process.env.AI_EMBEDDING_PROVIDER ?? 'openai').toLowerCase()
    if (value === 'openai' || value === 'lmstudio' || value === 'auto') {
      return value as EmbeddingProvider
    }
    return 'openai'
  }
  if (aiProvider === 'lmstudio') return 'lmstudio'
  return 'openai'
}

// バリデーション付きモデル設定
const getChatModel = () => {
  // 統一AI_CHAT_MODELを使用し、プロバイダー固有のデフォルトにフォールバック
  if (process.env.AI_CHAT_MODEL && process.env.AI_CHAT_MODEL !== 'gpt-4o') {
    return process.env.AI_CHAT_MODEL
  }
  
  // 後方互換性
  if (aiProvider === 'openrouter' && process.env.OPENROUTER_CHAT_MODEL) {
    return process.env.OPENROUTER_CHAT_MODEL
  }
  if (aiProvider === 'lmstudio' && process.env.LM_STUDIO_CHAT_MODEL) {
    return process.env.LM_STUDIO_CHAT_MODEL
  }
  
  // プロバイダー固有のデフォルト
  if (aiProvider === 'openrouter') return 'openai/gpt-4o'
  if (aiProvider === 'lmstudio') {
    const defaultModel = 'openai/gpt-oss-20b'
    // チャット用に埋め込みモデルの使用を防止
    const chatModel = process.env.LM_STUDIO_CHAT_MODEL ?? defaultModel
    if (chatModel.includes('embedding') || chatModel.includes('embed')) {
      console.warn(`警告: チャットモデル "${chatModel}" は埋め込みモデルのようです。デフォルトチャットモデルを使用します。`)
      return defaultModel
    }
    return chatModel
  }
  return 'gpt-4o' // OpenAIデフォルト
}

const getEmbeddingModel = () => {
  // 統一AI_EMBEDDING_MODELを使用し、プロバイダー固有のデフォルトにフォールバック
  if (process.env.AI_EMBEDDING_MODEL && process.env.AI_EMBEDDING_MODEL !== 'text-embedding-3-small') {
    return process.env.AI_EMBEDDING_MODEL
  }
  
  // 後方互換性
  if (aiProvider === 'openrouter' && process.env.OPENROUTER_EMBEDDING_MODEL) {
    return process.env.OPENROUTER_EMBEDDING_MODEL
  }
  if (aiProvider === 'lmstudio' && process.env.LM_STUDIO_EMBEDDING_MODEL) {
    return process.env.LM_STUDIO_EMBEDDING_MODEL
  }
  
  // プロバイダー固有のデフォルト
  if (aiProvider === 'openrouter') return 'text-embedding-3-small'
  if (aiProvider === 'lmstudio') return 'text-embedding-nomic-embed-text-v1.5'
  return 'text-embedding-3-small' // OpenAIデフォルト
}

export const AI_MODELS = {
  chat: getChatModel(),
  embedding: getEmbeddingModel()
}

// モデル出力からプレーンテキストをサニタイズする基本ユーティリティ（コードフェンス除去）
function sanitizePlainText(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  // ```ブロックが存在する場合は削除
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/)
  if (fenced?.[1]) return fenced[1].trim()
  return trimmed
}

/**
 * モック用のテキスト修正を生成
 */
function generateMockModifiedText(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): string {
  const userMessage = messages.find(m => m.role === 'user')
  const content = typeof userMessage?.content === 'string' ? userMessage.content : ''
  
  // 薬機法違反の可能性がある語句を安全な表現に置換
  return content
    .replace(/がん.*?(治る|治療|効く|効果)/g, '健康維持をサポート')
    .replace(/血圧.*?(下がる|降下|下げる)/g, '血圧の健康維持をサポート')
    .replace(/糖尿病.*?(治る|治療|改善)/g, '健康的な生活をサポート')
    .replace(/ダイエット.*?(痩せる|減量|効果)/g, '健康的な体型維持をサポート')
    ?? '健康維持にお役立ていただけます。'
}

/**
 * モック用の違反情報を生成
 */
function generateMockViolations(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Array<{ start: number; end: number; reason: string; dictionaryId?: number }> {
  const userMessage = messages.find(m => m.role === 'user')
  const content = typeof userMessage?.content === 'string' ? userMessage.content : ''
  
  const violations: Array<{ start: number; end: number; reason: string; dictionaryId?: number }> = []
  
  // 薬機法違反パターンをチェック
  const patterns = [
    { regex: /がん.*?(治る|治療|効く|効果)/g, reason: '医薬品的効能効果表現: がん治療効果の標榜は薬機法違反です', dictionaryId: 1 },
    { regex: /血圧.*?(下がる|降下|下げる)/g, reason: '医薬品的効能効果表現: 血圧降下効果は医薬品的効果に該当します', dictionaryId: 3 },
    { regex: /糖尿病.*?(治る|治療|改善)/g, reason: '医薬品的効能効果表現: 糖尿病治療効果は医薬品的効果です', dictionaryId: 2 },
    { regex: /必ず.*?(痩せる|効く|治る)/g, reason: '断定的表現: 「必ず」などの断定的表現は薬機法で禁止されています', dictionaryId: 4 }
  ]
  
  patterns.forEach(pattern => {
    let match
    while ((match = pattern.regex.exec(content)) !== null) {
      violations.push({
        start: match.index,
        end: match.index + match[0].length,
        reason: pattern.reason,
        dictionaryId: pattern.dictionaryId
      })
    }
  })
  
  return violations
}

// チャット完了を作成するユーティリティ関数
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
      // ツール呼び出しレスポンス（tool_calls形式）
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
                  modified: generateMockModifiedText(params.messages),
                  violations: generateMockViolations(params.messages)
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
    throw new Error('AIクライアントが利用できません。設定を確認してください。')
  }

  try {
    // OpenRouter用のパラメータ（OpenAIと同様の機能をサポート）
    if (aiProvider === 'openrouter') {
      // Base64サニタイゼーションなしで元のメッセージを使用
      const sanitizedMessages = params.messages

      const openRouterParams = {
        model: AI_MODELS.chat,
        messages: sanitizedMessages,
        tools: params.tools,
        tool_choice: params.tool_choice,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
      }

      try {
        const response = await aiClient!.chat.completions.create(openRouterParams)
        return response
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
            throw new Error('OpenRouterのクォータを超過しました。アカウントの残高を確認してください。')
          }
          if (error.message.includes('invalid_api_key') || error.message.includes('unauthorized')) {
            throw new Error('OpenRouter APIキーが無効です。AI_API_KEY環境変数を確認してください。')
          }
          if (error.message.includes('model_not_found') || error.message.includes('not found')) {
            throw new Error(`OpenRouterモデル "${AI_MODELS.chat}" が見つかりません。AI_CHAT_MODEL設定を確認してください。`)
          }
        }
        throw new Error(`OpenRouterチャット完了に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
      }
    }

    // LM Studio用のパラメータ簡略化（サポートされていない機能を回避）
    if (aiProvider === 'lmstudio') {
      const lmParams = {
        model: AI_MODELS.chat,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
        // LM Studioはtools/tool_choiceをサポートしていない可能性があるため除外
      }
      
      // LM Studioチャット完了リクエストの実行
      
      // LM Studioリクエスト用のタイムアウト処理を追加
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LM Studioチャット完了がタイムアウトしました（90秒）')), 90000)
      })
      
      const chatPromise = aiClient.chat.completions.create(lmParams)
      
      try {
        const response = await Promise.race([chatPromise, timeoutPromise])
        return response
      } catch (error) {
        // LM Studio固有のエラーを処理
        
        if (error instanceof Error) {
          // LM Studioの一般的なモデル関連エラーを処理
          if (error.message.includes('Failed to load model') && error.message.includes('not llm')) {
            throw new Error(`LM Studioモデルエラー: "${AI_MODELS.chat}" はチャット/LLMモデルではありません。LM Studioでチャットモデルを読み込んでください（例: microsoft/Phi-3-mini-4k-instruct-gguf, google/gemma-2-2b-it-gguf）。現在のモデルは埋め込みモデルのようです。設定のヘルプは /api/debug/model-validation を確認してください。`)
          }
          if (error.message.includes('model') && error.message.includes('not found')) {
            throw new Error(`LM Studioモデルが見つかりません: ${AI_MODELS.chat}。このモデルがLM Studioで読み込まれていることを確認してください。利用可能なモデルは /api/debug/model-validation で確認してください。`)
          }
          if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
            throw new Error('LM Studioが起動していないかアクセスできません。LM Studioを起動してチャットモデルを読み込んでください。接続状態は /api/debug/model-validation で確認してください。')
          }
          if (error.message.includes('timed out')) {
            throw new Error('LM Studioリクエストがタイムアウトしました。モデルが過負荷状態かリクエストが複雑すぎる可能性があります。')
          }
          if (error.message.includes('404')) {
            throw new Error(`LM Studio 404エラー: モデル "${AI_MODELS.chat}" が見つからないか正しく読み込まれていません。LM Studioを確認してチャットモデルが読み込まれていることを確認してください。設定のヘルプは /api/debug/model-validation を確認してください。`)
          }
        }
        
        throw new Error(`LM Studioチャット完了に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
      }
    }
    
    // OpenAI用の完全なパラメータを使用
    const response = await aiClient.chat.completions.create({
      model: AI_MODELS.chat,
      ...params,
    })
    return response
  } catch (error) {
    // チャット完了でエラーが発生
    
    throw new Error(`チャット完了の作成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

/**
 * Vision機能を持つLLMを使用して画像からテキストを抽出する
 * - 本番環境: OpenAI (gpt-4o)
 * - 開発環境: 利用可能な場合はLM Studio; visionをサポートしていない場合はガイダンス付きでエラーを投げる
 */
/**
 * LLMを使用して画像からテキストを抽出する（OCR処理）
 * LM StudioまたはOpenAIのVision機能を使用
 * @param imageUrl 処理対象の画像URL
 * @returns 抽出されたテキストと使用されたプロバイダー情報
 */
export async function extractTextFromImageWithLLM(imageUrl: string): Promise<{
  text: string
  provider: 'openai' | 'lmstudio' | 'openrouter'
  model: string
}> {
  // 本番環境ではOpenAIを優先、開発環境ではaiProviderの設定に従う
  // ただし、LM StudioがVision対応でない場合は明確なエラーを表示

  // マルチモーダル用のユーザーコンテンツを構築（OpenAI Vision 仕様に準拠）
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: '以下の画像に写っているすべての文字列を読み取り、読み順に沿って日本語で忠実に出力してください。装飾記号は必要に応じて省略して構いません。出力は純粋なテキストのみとし、説明や前置きは不要です。' },
    { type: 'image_url', image_url: { url: imageUrl } }
  ]

  // OpenRouterを使用する場合
  if (aiProvider === 'openrouter') {
    try {
      const response: unknown = await createChatCompletion({
        messages: [
          { role: 'system', content: 'あなたはOCRエンジンです。画像内の文字を正確に読み取り、プレーンテキストとして返します。' },
          { role: 'user', content: userContent }
        ],
        temperature: 0,
        max_tokens: 4000
      })

      const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('OpenRouterが画像リクエストに対してテキスト内容を返しませんでした')
      }
      return {
        text: sanitizePlainText(content),
        provider: 'openrouter',
        model: AI_MODELS.chat
      }
    } catch (error) {
      // OpenRouterでVision機能をサポートしていない場合の分かりやすいエラーメッセージ
      if (error instanceof Error && (
        error.message.includes('image') ||
        error.message.toLowerCase().includes('vision') ||
        error.message.includes('not supported') ||
        error.message.includes('unsupported')
      )) {
        throw new Error('OpenRouterの現在のモデルは画像入力（Vision）をサポートしていません。Vision対応のモデル（gpt-4oやgpt-4-turbo等）を選択してください。')
      }
      throw error
    }
  }

  // 開発環境でLM Studioが設定されている場合は最初に試行
  if (aiProvider === 'lmstudio') {
    try {
      const response: unknown = await createChatCompletion({
        messages: [
          { role: 'system', content: 'あなたはOCRエンジンです。画像内の文字を正確に読み取り、プレーンテキストとして返します。' },
          { role: 'user', content: userContent }
        ],
        temperature: 0,
        max_tokens: 4000
      })

      const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('LM Studioが画像リクエストに対してテキスト内容を返しませんでした')
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
      { role: 'user', content: userContent }
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

// OCR品質のヒューリスティックスコア（長さ/ユニーク文字数/文字化けの有無）
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

// 埋め込み作成用ユーティリティ関数
/**
 * テキストの埋め込みベクトルを生成する
 * 辞書エントリの類似性検索に使用される
 * @param input 埋め込みベクトルを生成するテキスト
 * @returns 埋め込みベクトルの数値配列
 */
// OpenAI埋め込み用ヘルパー関数
async function createOpenAIEmbedding(input: string): Promise<number[]> {
  const client = ensureOpenAIEmbeddingClient() ?? openaiClient
  if (!client) {
    throw new Error('OpenAI埋め込みクライアントが利用できません。OPENAI_API_KEY 環境変数を設定してください。')
  }
  
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input,
  })

  if (!response.data || response.data.length === 0) {
    throw new Error('OpenAI APIから埋め込みデータが返されませんでした')
  }
  
  if (!response.data[0]?.embedding) {
    throw new Error('OpenAI応答に埋め込みデータがありません')
  }
  
  return response.data[0].embedding
}

// LM Studio埋め込み用ヘルパー関数
async function createLMStudioEmbedding(input: string): Promise<number[]> {
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
      throw new Error(`LM Studio APIエラー: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.data && data.data.length > 0 && data.data[0]?.embedding) {
      // LM Studioの次元が異なる場合の処理
      const targetDim = getEmbeddingDimension()
      const emb: number[] = data.data[0].embedding
      if (emb.length === targetDim) return emb
      if (emb.length < targetDim) {
        return [...emb, ...new Array(targetDim - emb.length).fill(0)]
      }
      return emb.slice(0, targetDim)
    }
    
    throw new Error('LM Studio埋め込み応答にデータがありません')
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LM Studio埋め込みリクエストがタイムアウトしました（60秒）')
    }
    throw error
  }
}

export async function createEmbedding(input: string): Promise<number[]> {
  // テスト/モックモードでは模擬埋め込みを返す
  if (USE_MOCK) {
    // テスト/モックの期待値に合わせて動的に次元を決定
    const dim = 384
    const mockEmbedding = new Array(dim).fill(0).map(() => Math.random() - 0.5)
    return mockEmbedding
  }

  if (!aiClient) {
    throw new Error('AIクライアントが利用できません。設定を確認してください。')
  }

  try {
    // OpenRouter用: embeddings APIはサポートされていないため、選択されたproviderを使用
    if (aiProvider === 'openrouter') {
      const provider = getEmbeddingProvider()
      switch (provider) {
        case 'openai':
          return await createOpenAIEmbedding(input)
        case 'lmstudio':
          return await createLMStudioEmbedding(input)
        case 'auto':
          // OpenAI -> LM Studio の順で自動フォールバック
          try {
            return await createOpenAIEmbedding(input)
          } catch (openaiError) {
            try {
              return await createLMStudioEmbedding(input)
            } catch (lmstudioError) {
              throw new Error(`すべての埋め込みプロバイダーが失敗しました。OpenAI: ${openaiError instanceof Error ? openaiError.message : '不明なエラー'}。LM Studio: ${lmstudioError instanceof Error ? lmstudioError.message : '不明なエラー'}`)
            }
          }
      }
    }

    // LM Studio用：統一されたヘルパー関数を使用
    if (aiProvider === 'lmstudio') {
      return await createLMStudioEmbedding(input)
    }
    
    // OpenAI用：統一されたヘルパー関数を使用
    return await createOpenAIEmbedding(input)
  } catch (error) {
    // 埋め込み作成中にエラーが発生
    
    if (aiProvider === 'lmstudio') {
      throw new Error(`LM Studio埋め込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}。LM Studioが実行中で埋め込みモデルが読み込まれているか確認してください。`)
    }
    
    throw new Error(`埋め込みの作成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

// デバッグとモニタリング用の追加ユーティリティ関数
/**
 * 現在のAIクライアント設定と可用性の概要を返す。
 *
 * @returns 設定、利用中モデル、キー有無、クライアント可用性などのメタ情報
 */
export function getAIClientInfo() {
  const embeddingProvider = getEmbeddingProvider()
  
  return {
    aiProvider: aiProvider,
    embeddingProvider: embeddingProvider,
    isUsingLMStudio: aiProvider === 'lmstudio',
    isUsingOpenRouter: aiProvider === 'openrouter',
    isUsingOpenAI: aiProvider === 'openai',
    currentChatModel: AI_MODELS.chat,
    currentEmbeddingModel: AI_MODELS.embedding,
    hasValidApiKey: hasValidApiKey,
    clientAvailable: !!aiClient,
    environment: process.env.NODE_ENV,
    isMockMode: USE_MOCK,
    // 新しい統一設定
    aiApiKey: process.env.AI_API_KEY ? '***' : undefined,
    aiChatModel: process.env.AI_CHAT_MODEL,
    aiEmbeddingModel: process.env.AI_EMBEDDING_MODEL,
    aiEmbeddingProvider: process.env.AI_EMBEDDING_PROVIDER,
    // 後方互換性情報
    legacyOpenAIKey: legacyOpenAIKey ? '***' : undefined,
    legacyOpenRouterKey: legacyOpenRouterKey ? '***' : undefined,
    lmStudioBaseUrl: process.env.LM_STUDIO_BASE_URL,
    // クライアント可用性（チャット/埋め込み）
    openaiClientAvailable: !!openaiClient,
    openaiEmbeddingClientAvailable: !!openaiEmbeddingClient,
    lmStudioEmbeddingAvailable: !!process.env.LM_STUDIO_BASE_URL
  }
}

// モデル設定の検証と提案を行う関数
/**
 * モデル設定の妥当性を検証し、問題点と提案を返す。
 *
 * - LM Studio のチャット/埋め込みモデルの取り違いを検出
 * - OpenRouter 使用時の埋め込みプロバイダー設定を検証
 *
 * @returns 妥当性、検出された課題、提案、現在構成
 */
export function validateModelConfiguration() {
  const issues = []
  const suggestions = []
  const embeddingProvider = getEmbeddingProvider()
  
  // メインAIプロバイダー設定の検証
  if (aiProvider === 'lmstudio') {
    const chatModel = AI_MODELS.chat
    const embeddingModel = AI_MODELS.embedding
    
    // チャットモデルが埋め込みモデルのように見えるかをチェック
    if (chatModel.includes('embedding') || chatModel.includes('embed')) {
      issues.push(`チャットモデル "${chatModel}" は埋め込みモデルのようです`)
      suggestions.push('AI_CHAT_MODELを適切なチャットモデル（例："microsoft/Phi-3-mini-4k-instruct-gguf"）に設定してください')
    }
    
    // 埋め込みモデルがチャットモデルのように見えるかをチェック
    if (!embeddingModel.includes('embedding') && !embeddingModel.includes('embed')) {
      issues.push(`埋め込みモデル "${embeddingModel}" は埋め込みモデルではない可能性があります`)
      suggestions.push('AI_EMBEDDING_MODELを適切な埋め込みモデル（例："text-embedding-nomic-embed-text-v1.5"）に設定してください')
    }
  }
  
  // OpenRouter用の埋め込みプロバイダー設定を検証
  if (aiProvider === 'openrouter') {
    const embeddingProviderValue = process.env.AI_EMBEDDING_PROVIDER
    
    if (embeddingProviderValue && !['openai', 'lmstudio', 'auto'].includes(embeddingProviderValue)) {
      issues.push(`Invalid AI_EMBEDDING_PROVIDER: "${embeddingProviderValue}"`)
      suggestions.push('Set AI_EMBEDDING_PROVIDER to "openai", "lmstudio", or "auto"')
    }
    
    // 各プロバイダーに必要な依存関係が利用可能かをチェック
    if (embeddingProvider === 'openai' || embeddingProvider === 'auto') {
      if (!openaiEmbeddingClient && !openaiClient) {
        issues.push('OpenAI client not available for embeddings')
        suggestions.push('Set AI_API_KEY environment variable and AI_PROVIDER=openai (preferred), or OPENAI_API_KEY for backward compatibility, for OpenAI embeddings')
      }
    }
    
    if (embeddingProvider === 'lmstudio' || embeddingProvider === 'auto') {
      if (!process.env.LM_STUDIO_BASE_URL) {
        issues.push('LM Studio base URL not configured for embeddings')
        suggestions.push('Set LM_STUDIO_BASE_URL environment variable for LM Studio embeddings')
      }
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    currentConfig: getAIClientInfo()
  }
}

// モックモードを使用しているかをチェックするユーティリティ関数
/**
 * モックモード（テスト環境）かどうかを返す。
 *
 * @returns モック使用中ならtrue
 */
export function isUsingMock(): boolean {
  return USE_MOCK
}

// 使用中のモデルに基づいて埋め込み次元数を取得
/**
 * 使用中モデルに対する埋め込み次元数を返す。
 *
 * - モック時は 384、通常時は DB に合わせ 1536
 *
 * @returns 埋め込み次元数
 */
export function getEmbeddingDimension(): number {
  if (USE_MOCK) {
    return 384 // モック埋め込み次元数
  }
  // DBは1536次元に統一（migrations参照）
  return 1536
}

// check-processor互換性のためのレガシーcreateChatCompletion

type LegacyDictionaryEntry = {
  id: number
  phrase: string
  category: string
  similarity?: number
}

type LegacyViolationData = {
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
}

/**
 * チェック処理用のチャット補完を実行するユーティリティ（レガシー互換）。
 *
 * - OpenAI/OpenRouter: Function calling を用いて JSON を取得
 * - LM Studio: テキスト応答から JSON を抽出・検証
 *
 * @param text 解析対象テキスト（OCR済みを含む）
 * @param relevantEntries 参考辞書エントリー（上位スコア順）
 * @returns プロバイダー種別、（必要に応じて）生レスポンス、違反配列、修正文
 */
export async function createChatCompletionForCheck(text: string, relevantEntries: LegacyDictionaryEntry[]): Promise<{
  type: 'openai' | 'lmstudio' | 'openrouter'
  response?: OpenAI.Chat.Completions.ChatCompletion
  violations: LegacyViolationData[]
  modified: string
}> {

  // 辞書情報の表示方法を簡潔化
  const dictionaryReference = relevantEntries.length > 0
    ? `参考: ${relevantEntries.slice(0, 3).map(e => e.phrase).join(', ')}`
    : ''

  // 長い文章用の軽量プロンプト
  const messages = [
    {
      role: 'system' as const,
      content: `薬機法専門家として違反表現を検出・修正してください。

${dictionaryReference}

修正方針:
- 違反表現は薬機法に準拠した適切な表現に置き換える
- 元の文章の意味と構造を可能な限り保持する  
- 断定的な表現は推定や可能性を示す表現に変更
- 医療的・治療的効果の主張は一般的な健康支援表現に変更
- 過度な効果を暗示する表現は控えめな表現に修正

【重要】必ずJSON形式で回答してください。JSON以外のテキストは含めないでください。

出力形式（必須）:
{
  "modified": "修正されたテキスト",
  "violations": [{"start_pos": 0, "end_pos": 3, "reason": "違反理由の詳細", "dictionary_id": null}]
}

注意：
- 応答はJSON形式のみで行う
- 説明文や追加のテキストは一切含めない
- violations配列が空の場合でも配列として出力する
- 必ず有効なJSON構造を保つ`
    },
    {
      role: 'user' as const,
      content: text
    }
  ]

  if (aiProvider === 'openrouter') {
    // OpenRouterモード - ファンクション呼び出しを使用（OpenAIと同様）
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
              description: '元のテキストの意味と構造を保持しつつ、違反表現を薬機法準拠の適切な表現に置き換えた修正版テキスト'
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
      type: 'openrouter',
      response: response as OpenAI.Chat.Completions.ChatCompletion,
      violations: [],
      modified: ''
    }
  } else if (aiProvider === 'lmstudio') {
    // LM Studioモード - コンテンツからJSONを解析
    const response = await createChatCompletion({
      messages,
      temperature: 0.1,
      max_tokens: 2000 // 長い文章に対応
    })

    const content = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LM Studioが応答内容を返しませんでした')
    }

    // 改善された解析でレスポンスからJSONを抽出
    console.log('[AI] LM Studio raw response:', content)
    
    // 複数のJSON抽出パターンを試行
    let jsonStr = null
    
    // パターン1: Markdownコードブロック内のJSON
    let jsonMatch = content.match(/```json\s*([^`]+)\s*```/i)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
      console.log('[AI] Found JSON in markdown code block:', jsonStr)
    } else {
      // パターン2: JSONコードブロック（言語指定なし）
      jsonMatch = content.match(/```\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
        console.log('[AI] Found JSON in generic code block:', jsonStr)
      } else {
        // パターン3: 堅牢なJSON抽出（ネストしたオブジェクトに対応）
        jsonStr = extractCompleteJSON(content)
        if (jsonStr) {
          console.log('[AI] Found JSON using robust extraction:', jsonStr)
        }
      }
    }
    
    if (!jsonStr) {
      console.warn('[AI] No JSON found in LM Studio response. Attempting fallback generation...')
      // フォールバック: プレーンテキストからJSONを生成
      try {
        jsonStr = generateJSONFromPlainText(text, content)
        console.log('[AI] Successfully generated JSON from plain text using fallback')
      } catch (fallbackError) {
        console.error('[AI] Fallback JSON generation failed:', fallbackError)
        console.error('[AI] Original LM Studio response:', content)
        throw new Error('LM Studio応答にJSON形式が見つからず、フォールバック処理も失敗しました')
      }
    }
    
    // JSON文字列を抽出完了

    try {
      console.log('[AI] Attempting to parse JSON:', jsonStr)
      const parsed = JSON.parse(jsonStr)
      console.log('[AI] Successfully parsed JSON:', parsed)
      
      // より柔軟な構造チェック
      const modified = parsed.modified ?? parsed.modifiedText ?? parsed.modified_text ?? ''
      const violations = parsed.violations ?? parsed.violationList ?? parsed.violation_list ?? []
      
      if (!modified || typeof modified !== 'string') {
        console.error('[AI] Invalid modified field:', { modified, type: typeof modified })
        throw new Error('応答の修正フィールドが無効です')
      }
      
      if (!Array.isArray(violations)) {
        console.error('[AI] Invalid violations field:', { violations, type: typeof violations, isArray: Array.isArray(violations) })
        throw new Error('応答の違反フィールドが無効です')
      }

      console.log('[AI] LM Studio response successfully processed:', { 
        modified: modified.substring(0, 100) + (modified.length > 100 ? '...' : ''),
        violationsCount: violations.length 
      })

      return {
        type: 'lmstudio',
        violations,
        modified
      }
    } catch (error) {
      console.error('[AI] JSON parsing error:', error)
      console.error('[AI] Failed JSON string:', jsonStr)
      console.error('[AI] Original content:', content)
      throw new Error(`LM Studio JSON応答の解析に失敗しました: ${error}`)
    }
  } else {
    // OpenAIモード - ファンクション呼び出しを使用
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
              description: '元のテキストの意味と構造を保持しつつ、違反表現を薬機法準拠の適切な表現に置き換えた修正版テキスト'
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
      max_tokens: 2000 // 長い文章に対応
    })

    return {
      type: 'openai',
      response: response as OpenAI.Chat.Completions.ChatCompletion,
      violations: [], // 呼び出し元で抽出される
      modified: '' // 呼び出し元で抽出される
    }
  }
}
