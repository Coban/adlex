/**
 * Mock Client 実装
 * テスト用モッククライアント
 */

import OpenAI from 'openai'

import { AIProvider, ChatCompletionRequest, ChatCompletionResponse, EmbeddingRequest, EmbeddingResponse } from './types'

/**
 * モック用の修正テキストを生成
 */
function generateMockModifiedText(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): string {
  const userMessage = messages.find(m => m.role === 'user')
  const content = typeof userMessage?.content === 'string' ? userMessage.content : ''
  
  // 簡単な置換ルール
  return content
    .replace(/治る|治療|効く/g, '健康維持をサポート')
    .replace(/必ず/g, '多くの場合')
    .replace(/がん/g, '健康状態')
    .replace(/血圧.*?(下がる|降下|下げる)/g, '血圧の健康維持をサポート')
    ?? 'このサプリメントは健康維持にお役立ていただけます。'
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

/**
 * Mock Provider実装
 */
export class MockProvider implements AIProvider {
  private chatModel: string
  private embeddingModel: string

  constructor(chatModel = 'mock-chat-model', embeddingModel = 'mock-embedding-model') {
    this.chatModel = chatModel
    this.embeddingModel = embeddingModel
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // ファンクション呼び出しリクエストかどうかをチェック
    if (request.functions && request.functions.length > 0) {
      // ツール呼び出しレスポンス
      return {
        content: '',
        function_call: {
          name: 'apply_yakukiho_rules',
          arguments: JSON.stringify({
            modified: generateMockModifiedText(request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
            violations: generateMockViolations(request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[])
          })
        },
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    } else {
      // 通常のコンテンツレスポンス
      return {
        content: JSON.stringify({
          modified: "このサプリメントは健康維持にお役立ていただけます。血圧の健康維持をサポートします。",
          violations: [
            {
              start: 0,
              end: 4,
              reason: "「がん」は医薬品的効能効果表現のため「健康状態」に修正",
              dictionaryId: 1
            }
          ]
        }),
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }
    }
  }

  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input]
    
    return {
      data: inputs.map((_, index) => ({
        embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
        index
      })),
      usage: {
        prompt_tokens: inputs.join('').length,
        total_tokens: inputs.join('').length
      }
    }
  }

  async validateConfig(): Promise<boolean> {
    return true
  }

  getModelInfo() {
    return {
      chatModel: this.chatModel,
      embeddingModel: this.embeddingModel
    }
  }
}