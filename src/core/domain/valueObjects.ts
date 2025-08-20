import { ValidationError } from './errors'

/**
 * Value Objectのベースクラス
 */
export abstract class ValueObject<T> {
  protected constructor(public readonly value: T) {}

  equals(other: ValueObject<T>): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value)
  }
}

/**
 * メールアドレス値オブジェクト
 */
export class EmailAddress extends ValueObject<string> {
  private constructor(value: string) {
    super(value)
  }

  static create(email: string): EmailAddress {
    if (!EmailAddress.isValidEmail(email)) {
      throw new ValidationError('無効なメールアドレス形式です', 'email')
    }
    return new EmailAddress(email.toLowerCase().trim())
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  getDomain(): string {
    return this.value.split('@')[1]
  }

  getLocalPart(): string {
    return this.value.split('@')[0]
  }
}

/**
 * 辞書フレーズ値オブジェクト
 */
export class DictionaryPhrase extends ValueObject<string> {
  private constructor(value: string) {
    super(value)
  }

  static create(phrase: string): DictionaryPhrase {
    const trimmedPhrase = phrase.trim()
    
    if (trimmedPhrase.length === 0) {
      throw new ValidationError('フレーズが空です', 'phrase')
    }
    
    if (trimmedPhrase.length > 500) {
      throw new ValidationError('フレーズが長すぎます（500文字以内）', 'phrase')
    }

    // 薬機法に関連する基本的なバリデーション
    if (DictionaryPhrase.hasInvalidCharacters(trimmedPhrase)) {
      throw new ValidationError('無効な文字が含まれています', 'phrase')
    }

    return new DictionaryPhrase(trimmedPhrase)
  }

  private static hasInvalidCharacters(phrase: string): boolean {
    // 制御文字やタブなどをチェック（改行は許可）
    const invalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
    return invalidChars.test(phrase)
  }

  getLength(): number {
    return this.value.length
  }

  contains(searchTerm: string): boolean {
    return this.value.toLowerCase().includes(searchTerm.toLowerCase())
  }

  normalize(): string {
    return this.value.replace(/\s+/g, ' ').trim()
  }
}

/**
 * ベクトル値オブジェクト
 */
export class EmbeddingVector extends ValueObject<number[]> {
  private constructor(value: number[]) {
    super(value)
  }

  static create(vector: number[]): EmbeddingVector {
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new ValidationError('ベクトルは空でない配列である必要があります', 'vector')
    }

    if (vector.some(v => typeof v !== 'number' || isNaN(v))) {
      throw new ValidationError('ベクトルの要素は全て数値である必要があります', 'vector')
    }

    // 標準的な次元数チェック（OpenAIの場合1536次元など）
    if (vector.length !== 1536 && vector.length !== 512 && vector.length !== 768) {
      throw new ValidationError('サポートされていないベクトル次元です', 'vector')
    }

    return new EmbeddingVector([...vector]) // 配列のコピーを作成
  }

  static fromJSON(json: string): EmbeddingVector {
    try {
      const parsed = JSON.parse(json)
      return EmbeddingVector.create(parsed)
    } catch (error) {
      throw new ValidationError('無効なベクトルJSON形式です', 'vector', error as Error)
    }
  }

  getDimensions(): number {
    return this.value.length
  }

  toJSON(): string {
    return JSON.stringify(this.value)
  }

  /**
   * コサイン類似度を計算
   */
  cosineSimilarity(other: EmbeddingVector): number {
    if (this.value.length !== other.value.length) {
      throw new ValidationError('ベクトルの次元が一致しません')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < this.value.length; i++) {
      dotProduct += this.value[i] * other.value[i]
      normA += this.value[i] * this.value[i]
      normB += other.value[i] * other.value[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }
}

/**
 * テキスト範囲値オブジェクト
 */
export class TextRange extends ValueObject<{ start: number; end: number }> {
  private constructor(start: number, end: number) {
    super({ start, end })
  }

  static create(start: number, end: number): TextRange {
    if (start < 0) {
      throw new ValidationError('開始位置は0以上である必要があります', 'start')
    }
    
    if (end <= start) {
      throw new ValidationError('終了位置は開始位置より大きい必要があります', 'end')
    }

    return new TextRange(start, end)
  }

  get start(): number {
    return this.value.start
  }

  get end(): number {
    return this.value.end
  }

  getLength(): number {
    return this.end - this.start
  }

  contains(position: number): boolean {
    return position >= this.start && position < this.end
  }

  overlaps(other: TextRange): boolean {
    return this.start < other.end && this.end > other.start
  }

  extractFromText(text: string): string {
    if (this.end > text.length) {
      throw new ValidationError('テキスト範囲がテキスト長を超えています')
    }
    return text.slice(this.start, this.end)
  }
}

/**
 * 招待トークン値オブジェクト
 */
export class InvitationToken extends ValueObject<string> {
  private constructor(value: string) {
    super(value)
  }

  static create(token: string): InvitationToken {
    const trimmedToken = token.trim()
    
    if (trimmedToken.length === 0) {
      throw new ValidationError('招待トークンが空です', 'token')
    }
    
    // UUIDv4形式のチェック
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(trimmedToken)) {
      throw new ValidationError('無効な招待トークン形式です', 'token')
    }

    return new InvitationToken(trimmedToken)
  }

  static generate(): InvitationToken {
    // UUIDv4を生成
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
    
    return new InvitationToken(uuid)
  }

  toString(): string {
    return this.value
  }
}