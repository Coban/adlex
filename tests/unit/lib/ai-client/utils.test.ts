import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { 
  extractCompleteJSON, 
  findBalancedBraces, 
  generateJSONFromPlainText, 
  sanitizePlainText, 
  getSanitizedReferer, 
  generateMockModifiedText, 
  generateMockViolations, 
  estimateOcrConfidence, 
  validateModelConfiguration 
} from '@/lib/ai-client/utils'

describe('AI Client Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('extractCompleteJSON', () => {
    it('基本的なJSONオブジェクトを抽出できること', () => {
      const text = 'レスポンス: {"modified": "テスト", "violations": []}'
      const result = extractCompleteJSON(text)
      
      expect(result).toBe('{"modified": "テスト", "violations": []}')
      expect(() => JSON.parse(result!)).not.toThrow()
    })

    it('ネストしたJSONオブジェクトを抽出できること', () => {
      const text = '{"data": {"nested": {"deep": "value"}}, "status": "ok"}'
      const result = extractCompleteJSON(text)
      
      expect(result).not.toBeNull()
      if (result) {
        const parsed = JSON.parse(result)
        expect(parsed.data.nested.deep).toBe('value')
        expect(parsed.status).toBe('ok')
      }
    })

    it('配列を含むJSONを抽出できること', () => {
      const text = '{"violations": [{"start": 0, "end": 5}], "modified": "text"}'
      const result = extractCompleteJSON(text)
      
      expect(result).not.toBeNull()
      if (result) {
        const parsed = JSON.parse(result)
        expect(parsed.violations).toHaveLength(1)
        expect(parsed.violations[0].start).toBe(0)
        expect(parsed.modified).toBe('text')
      }
    })

    it('複数のJSONがある場合最初の有効なものを返すこと', () => {
      const text = '無効JSON: {invalid} 有効JSON: {"valid": true}'
      const result = extractCompleteJSON(text)
      
      expect(result).toBe('{"valid": true}')
    })

    it('JSONが存在しない場合nullを返すこと', () => {
      const text = 'これはただのテキストです。JSONはありません。'
      const result = extractCompleteJSON(text)
      
      expect(result).toBe(null)
    })

    it('文字列内の括弧を正しく処理できること', () => {
      const text = '{"message": "これは{テスト}メッセージです", "valid": true}'
      const result = extractCompleteJSON(text)
      
      expect(result).toBe('{"message": "これは{テスト}メッセージです", "valid": true}')
      expect(() => JSON.parse(result!)).not.toThrow()
    })
  })

  describe('findBalancedBraces', () => {
    it('バランスの取れた括弧を見つけられること', () => {
      const text = '{"outer": {"inner": "value"}, "end": true}'
      const result = findBalancedBraces(text)
      
      expect(result).toBe('{"outer": {"inner": "value"}, "end": true}')
    })

    it('エスケープされた引用符を正しく処理できること', () => {
      const text = '{"escaped": "string with \\"quotes\\" inside"}'
      const result = findBalancedBraces(text)
      
      expect(result).toBe('{"escaped": "string with \\"quotes\\" inside"}')
    })

    it('括弧が存在しない場合nullを返すこと', () => {
      const text = 'No braces here'
      const result = findBalancedBraces(text)
      
      expect(result).toBe(null)
    })

    it('不完全な括弧の場合nullを返すこと', () => {
      const text = '{"incomplete": "object"'
      const result = findBalancedBraces(text)
      
      expect(result).toBe(null)
    })
  })

  describe('generateJSONFromPlainText', () => {
    it('修正指示からJSONを生成できること', () => {
      const original = 'がんに効きます'
      const response = '健康維持に役立ちますに変更してください'
      const result = generateJSONFromPlainText(original, response)
      
      const parsed = JSON.parse(result)
      expect(parsed.modified).toBe('健康維持に役立ちます')
      expect(parsed.violations).toHaveLength(1)
      expect(parsed.violations[0].start_pos).toBe(0)
      expect(parsed.violations[0].end_pos).toBe(original.length)
    })

    it('単純な置換提案からJSONを生成できること', () => {
      const original = 'テスト'
      const response = '修正されたテスト'
      const result = generateJSONFromPlainText(original, response)
      
      const parsed = JSON.parse(result)
      expect(parsed.modified).toBe('修正されたテスト')
      expect(parsed.violations).toHaveLength(1)
    })

    it('元テキストと同じレスポンスの場合違反なしとすること', () => {
      const original = '問題のないテキスト'
      const response = '問題のないテキスト'
      const result = generateJSONFromPlainText(original, response)
      
      const parsed = JSON.parse(result)
      expect(parsed.modified).toBe(original)
      expect(parsed.violations).toHaveLength(0)
    })
  })

  describe('sanitizePlainText', () => {
    it('HTMLタグを除去できること', () => {
      const text = 'テスト<script>alert("xss")</script>内容'
      const result = sanitizePlainText(text)
      
      expect(result).toBe('テストscriptalert("xss")/script内容')
    })

    it('HTMLエンティティをエスケープできること', () => {
      const text = 'テスト&内容'
      const result = sanitizePlainText(text)
      
      expect(result).toBe('テスト&amp;内容')
    })

    it('空白文字をトリムできること', () => {
      const text = '  テスト内容  '
      const result = sanitizePlainText(text)
      
      expect(result).toBe('テスト内容')
    })
  })

  describe('getSanitizedReferer', () => {
    it('有効なHTTPSのURLをそのまま返すこと', () => {
      const referer = 'https://example.com:3000/path'
      const result = getSanitizedReferer(referer)
      
      expect(result).toBe('https://example.com:3000')
    })

    it('有効なHTTPのURLをそのまま返すこと', () => {
      const referer = 'http://localhost:3000/admin'
      const result = getSanitizedReferer(referer)
      
      expect(result).toBe('http://localhost:3000')
    })

    it('無効なプロトコルの場合デフォルトを返すこと', () => {
      const referer = 'ftp://example.com'
      const result = getSanitizedReferer(referer)
      
      expect(result).toBe('http://localhost:3000')
    })

    it('無効なURLの場合デフォルトを返すこと', () => {
      const referer = 'invalid-url'
      const result = getSanitizedReferer(referer)
      
      expect(result).toBe('http://localhost:3000')
    })

    it('nullの場合デフォルトを返すこと', () => {
      const result = getSanitizedReferer(null)
      
      expect(result).toBe('http://localhost:3000')
    })

    it('長すぎるURLを制限すること', () => {
      const longUrl = 'https://' + 'a'.repeat(200) + '.com'
      const result = getSanitizedReferer(longUrl)
      
      expect(result.length).toBeLessThanOrEqual(200)
    })
  })

  describe('generateMockModifiedText', () => {
    it('薬機法違反表現を安全な表現に置換できること', () => {
      const messages = [
        { role: 'user' as const, content: 'がんが治る薬です' }
      ]
      const result = generateMockModifiedText(messages)
      
      expect(result).toBe('健康状態が健康維持をサポート薬です')
    })

    it('血圧関連の表現を適切に置換できること', () => {
      const messages = [
        { role: 'user' as const, content: '血圧が下がるサプリ' }
      ]
      const result = generateMockModifiedText(messages)
      
      expect(result).toBe('血圧の健康維持をサポートサプリ')
    })

    it('ユーザーメッセージがない場合デフォルトテキストを返すこと', () => {
      const messages = [
        { role: 'system' as const, content: 'システムメッセージ' }
      ]
      const result = generateMockModifiedText(messages)
      
      expect(result).toBe('このサプリメントは健康維持にお役立ていただけます。')
    })
  })

  describe('generateMockViolations', () => {
    it('がん治療表現の違反を検出できること', () => {
      const messages = [
        { role: 'user' as const, content: 'がんに効く薬です' }
      ]
      const result = generateMockViolations(messages)
      
      expect(result).toHaveLength(1)
      expect(result[0].reason).toContain('がん治療効果')
      expect(result[0].dictionaryId).toBe(1)
    })

    it('血圧降下表現の違反を検出できること', () => {
      const messages = [
        { role: 'user' as const, content: '血圧が下がる効果' }
      ]
      const result = generateMockViolations(messages)
      
      expect(result).toHaveLength(1)
      expect(result[0].reason).toContain('血圧降下効果')
      expect(result[0].dictionaryId).toBe(3)
    })

    it('複数の違反を検出できること', () => {
      const messages = [
        { role: 'user' as const, content: 'がんが治る効果があり、血圧も下がる効果があります' }
      ]
      const result = generateMockViolations(messages)
      
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('違反がない場合空配列を返すこと', () => {
      const messages = [
        { role: 'user' as const, content: '健康維持をサポートします' }
      ]
      const result = generateMockViolations(messages)
      
      expect(result).toEqual([])
    })
  })

  describe('estimateOcrConfidence', () => {
    it('日本語が多いテキストで高い信頼度を返すこと', () => {
      const text = 'これは日本語のテキストです'
      const confidence = estimateOcrConfidence(text)
      
      expect(confidence).toBeGreaterThan(0.8)
      expect(confidence).toBeLessThanOrEqual(0.95)
    })

    it('英語が多いテキストで低い信頼度を返すこと', () => {
      const text = 'This is English text'
      const confidence = estimateOcrConfidence(text)
      
      expect(confidence).toBeLessThan(0.5)
    })

    it('空文字の場合0を返すこと', () => {
      const confidence = estimateOcrConfidence('')
      expect(confidence).toBe(0)
    })

    it('空白のみの場合0を返すこと', () => {
      const confidence = estimateOcrConfidence('   ')
      expect(confidence).toBe(0)
    })

    it('混合テキストで適切な信頼度を返すこと', () => {
      const text = 'これはmixed textです'
      const confidence = estimateOcrConfidence(text)
      
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThan(1)
    })
  })

  describe('validateModelConfiguration', () => {
    it('有効なOpenAI設定でtrueを返すこと', () => {
      const config = {
        provider: 'openai' as const,
        chatModel: 'gpt-4o',
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'valid-key'
      }
      
      expect(validateModelConfiguration(config)).toBe(true)
    })

    it('有効なOpenRouter設定でtrueを返すこと', () => {
      const config = {
        provider: 'openrouter' as const,
        chatModel: 'openai/gpt-4o',
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'valid-openrouter-key'
      }
      
      expect(validateModelConfiguration(config)).toBe(true)
    })

    it('有効なLM Studio設定でtrueを返すこと', () => {
      const config = {
        provider: 'lmstudio' as const,
        chatModel: 'local-model',
        embeddingModel: 'local-embedding',
        baseURL: 'http://localhost:1234/v1'
      }
      
      expect(validateModelConfiguration(config)).toBe(true)
    })

    it('Mock設定でtrueを返すこと', () => {
      const config = {
        provider: 'mock' as const,
        chatModel: 'mock-model',
        embeddingModel: 'mock-embedding'
      }
      
      expect(validateModelConfiguration(config)).toBe(true)
    })

    it('APIキーが欠けているOpenAI設定でfalseを返すこと', () => {
      const config = {
        provider: 'openai' as const,
        chatModel: 'gpt-4o',
        embeddingModel: 'text-embedding-3-small'
      }
      
      expect(validateModelConfiguration(config)).toBe(false)
    })

    it('baseURLが欠けているLM Studio設定でfalseを返すこと', () => {
      const config = {
        provider: 'lmstudio' as const,
        chatModel: 'local-model',
        embeddingModel: 'local-embedding'
      }
      
      expect(validateModelConfiguration(config)).toBe(false)
    })

    it('プロバイダーが欠けている設定でfalseを返すこと', () => {
      const config = {
        chatModel: 'gpt-4o',
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'key'
      } as any
      
      expect(validateModelConfiguration(config)).toBe(false)
    })

    it('チャットモデルが欠けている設定でfalseを返すこと', () => {
      const config = {
        provider: 'openai' as const,
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'key'
      } as any
      
      expect(validateModelConfiguration(config)).toBe(false)
    })

    it('サポートされていないプロバイダーでfalseを返すこと', () => {
      const config = {
        provider: 'unsupported' as any,
        chatModel: 'model',
        embeddingModel: 'embedding',
        apiKey: 'key'
      }
      
      expect(validateModelConfiguration(config)).toBe(false)
    })
  })
})