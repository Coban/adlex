/**
 * AI Client ユーティリティ関数
 * JSON解析、テキスト処理、バリデーション機能
 */

import OpenAI from 'openai'
import { LegacyViolationData, ModelConfiguration } from './types'

/**
 * テキストからネストしたJSONオブジェクトを抽出する堅牢な関数
 * 複数のレベルでネストしたオブジェクトと配列に対応
 */
export function extractCompleteJSON(text: string): string | null {
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
export function findBalancedBraces(text: string): string | null {
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
export function generateJSONFromPlainText(originalText: string, plainTextResponse: string): string {
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
  
  console.log('[AI] Generated JSON result:', result)
  return result
}

/**
 * プレーンテキストをサニタイズ（HTMLエスケープなど）
 */
export function sanitizePlainText(text: string): string {
  return text
    .replace(/[<>]/g, '') // HTMLタグ除去
    .replace(/[&]/g, '&amp;') // HTMLエンティティエスケープ
    .trim()
}

/**
 * Refererヘッダーから安全な値を取得
 */
export function getSanitizedReferer(referer: string | null): string {
  if (!referer) return 'http://localhost:3000'
  
  try {
    const url = new URL(referer)
    // http/https のみ許可し、クレデンシャル・パス等は含めず origin に固定
    if (!/^https?:$/.test(url.protocol)) return 'http://localhost:3000'
    const origin = url.origin
    // 長さを制限（ヘッダー肥大対策）
    return origin.length > 200 ? origin.slice(0, 200) : origin
  } catch {
    return 'http://localhost:3000'
  }
}

/**
 * モック用の修正テキストを生成
 */
export function generateMockModifiedText(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): string {
  const userMessage = messages.find(m => m.role === 'user')
  const content = typeof userMessage?.content === 'string' ? userMessage.content : ''
  
  // 簡単な置換ルール
  return content
    .replace(/治る|治療|効く/g, '健康維持をサポート')
    .replace(/必ず/g, '多くの場合')
    .replace(/がん/g, '健康状態')
    .replace(/血圧.*?(下がる|降下|下げる)/g, '血圧の健康維持をサポート')
    || 'このサプリメントは健康維持にお役立ていただけます。'
}

/**
 * モック用の違反情報を生成
 */
export function generateMockViolations(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Array<{ start: number; end: number; reason: string; dictionaryId?: number }> {
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
 * OCR信頼度を推定（画像解析用）
 */
export function estimateOcrConfidence(text: string): number {
  if (!text || text.trim().length === 0) return 0
  
  // 基本的な信頼度計算
  const japaneseCharCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length
  const totalCharCount = text.length
  const japaneseRatio = totalCharCount > 0 ? japaneseCharCount / totalCharCount : 0
  
  // 日本語の割合が高いほど信頼度が高い
  return Math.min(0.95, Math.max(0.1, japaneseRatio * 1.2))
}

/**
 * モデル設定のバリデーション
 */
export function validateModelConfiguration(config: ModelConfiguration): boolean {
  if (!config.provider) return false
  if (!config.chatModel) return false
  if (!config.embeddingModel) return false
  
  // プロバイダー別バリデーション
  switch (config.provider) {
    case 'openai':
    case 'openrouter':
      return !!config.apiKey
    case 'lmstudio':
      return !!config.baseURL
    case 'mock':
      return true
    default:
      return false
  }
}