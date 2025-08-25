/**
 * OCR信頼度推定機能
 * 日本語テキストのOCR結果の品質を評価
 */

export interface ConfidenceFactors {
  /** テキスト品質スコア (0-1) */
  textQuality: number
  /** 日本語特有の品質スコア (0-1) */
  japaneseTextQuality: number
  /** 構造的品質スコア (0-1) */
  structuralQuality: number
  /** 画像品質による影響スコア (0-1) */
  imageQualityImpact: number
}

export interface ConfidenceResult {
  /** 総合信頼度スコア (0-1) */
  overallScore: number
  /** 各要素の詳細スコア */
  factors: ConfidenceFactors
  /** 信頼度レベル */
  level: 'very-high' | 'high' | 'medium' | 'low' | 'very-low'
  /** 推定の詳細情報 */
  details: {
    characterCount: number
    japaneseCharacterRatio: number
    corruptionIndicators: string[]
    structuralIndicators: string[]
  }
}

// 日本語文字の正規表現
const HIRAGANA_REGEX = /[\u3040-\u309f]/g
const KATAKANA_REGEX = /[\u30a0-\u30ff]/g
const KANJI_REGEX = /[\u4e00-\u9faf]/g
const JAPANESE_PUNCTUATION_REGEX = /[。、！？「」『』（）]/g

// 文字化け・破損指標
const CORRUPTION_INDICATORS = [
  /�/g, // Unicode replacement character
  /[^\x00-\x7F\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3000-\u303f\uff00-\uffef]/g, // 非ASCII・非日本語文字
  /(.)\1{5,}/g, // 同一文字の過度な連続
  /[a-zA-Z]{20,}/g, // 異常に長いアルファベット文字列
  /\d{15,}/g // 異常に長い数字列
]

/**
 * OCRテキストの信頼度を推定
 */
export function estimateOcrConfidence(
  extractedText: string,
  imageInfo?: {
    width?: number
    height?: number
    sizeBytes: number
    processingTimeMs?: number
  }
): ConfidenceResult {
  const textLength = extractedText.length
  
  // 空テキストの場合
  if (textLength === 0) {
    return {
      overallScore: 0,
      level: 'very-low',
      factors: {
        textQuality: 0,
        japaneseTextQuality: 0,
        structuralQuality: 0,
        imageQualityImpact: 0.5
      },
      details: {
        characterCount: 0,
        japaneseCharacterRatio: 0,
        corruptionIndicators: ['empty-text'],
        structuralIndicators: ['no-structure']
      }
    }
  }

  // 各品質要素を計算
  const textQuality = calculateTextQuality(extractedText)
  const japaneseTextQuality = calculateJapaneseTextQuality(extractedText)
  const structuralQuality = calculateStructuralQuality(extractedText)
  const imageQualityImpact = calculateImageQualityImpact(imageInfo)

  const factors: ConfidenceFactors = {
    textQuality,
    japaneseTextQuality,
    structuralQuality,
    imageQualityImpact
  }

  // 重み付け平均で総合スコアを計算
  const weights = {
    textQuality: 0.3,
    japaneseTextQuality: 0.3,
    structuralQuality: 0.2,
    imageQualityImpact: 0.2
  }

  const overallScore = 
    factors.textQuality * weights.textQuality +
    factors.japaneseTextQuality * weights.japaneseTextQuality +
    factors.structuralQuality * weights.structuralQuality +
    factors.imageQualityImpact * weights.imageQualityImpact

  // 信頼度レベルを決定
  const level = determineConfidenceLevel(overallScore)

  // 詳細情報を収集
  const details = {
    characterCount: textLength,
    japaneseCharacterRatio: calculateJapaneseCharacterRatio(extractedText),
    corruptionIndicators: detectCorruptionIndicators(extractedText),
    structuralIndicators: detectStructuralIndicators(extractedText)
  }

  return {
    overallScore,
    level,
    factors,
    details
  }
}

/**
 * テキスト品質スコアを計算
 */
function calculateTextQuality(text: string): number {
  let score = 1.0
  const textLength = text.length

  // 文字化け指標をチェック
  for (const indicator of CORRUPTION_INDICATORS) {
    const matches = text.match(indicator)
    if (matches) {
      const corruptionRatio = matches.join('').length / textLength
      score -= corruptionRatio * 0.5 // 文字化け比率に応じて減点
    }
  }

  // 異常に短いテキスト
  if (textLength < 5) {
    score *= 0.5
  }

  // 異常に長いテキスト（OCR品質低下の可能性）
  if (textLength > 5000) {
    score *= 0.9
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * 日本語テキスト品質スコアを計算
 */
function calculateJapaneseTextQuality(text: string): number {
  const japaneseRatio = calculateJapaneseCharacterRatio(text)
  
  // 日本語文字がない場合
  if (japaneseRatio === 0) {
    return 0.3 // 完全に0にはせず、英数字のみの場合も考慮
  }

  let score = japaneseRatio

  // ひらがな、カタカナ、漢字のバランスをチェック
  const hiraganaCount = (text.match(HIRAGANA_REGEX) ?? []).length
  const katakanaCount = (text.match(KATAKANA_REGEX) ?? []).length
  const kanjiCount = (text.match(KANJI_REGEX) ?? []).length
  const totalJapanese = hiraganaCount + katakanaCount + kanjiCount

  if (totalJapanese > 0) {
    // 自然な日本語の場合、ひらがなが最も多く、漢字、カタカナの順になることが多い
    const hiraganaRatio = hiraganaCount / totalJapanese
    const kanjiRatio = kanjiCount / totalJapanese
    const katakanaRatio = katakanaCount / totalJapanese

    // バランスボーナス
    if (hiraganaRatio > 0.3 && hiraganaRatio < 0.8) {
      score += 0.1
    }
    if (kanjiRatio > 0.1 && kanjiRatio < 0.6) {
      score += 0.1
    }

    // 単一文字種のペナルティ
    if (hiraganaRatio > 0.95 || katakanaRatio > 0.95 || kanjiRatio > 0.95) {
      score -= 0.2
    }
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * 構造的品質スコアを計算
 */
function calculateStructuralQuality(text: string): number {
  let score = 0.5 // ベーススコア

  // 句読点の存在
  const punctuationMatches = text.match(JAPANESE_PUNCTUATION_REGEX)
  if (punctuationMatches && punctuationMatches.length > 0) {
    score += 0.2
  }

  // 適切な行の長さ
  const lines = text.split('\n')
  const averageLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length
  
  if (averageLineLength > 5 && averageLineLength < 100) {
    score += 0.1
  }

  // 空行の適切な使用
  const emptyLines = lines.filter(line => line.trim() === '').length
  const emptyLineRatio = emptyLines / lines.length
  
  if (emptyLineRatio > 0 && emptyLineRatio < 0.5) {
    score += 0.1
  }

  // 単語間スペースの適切な使用
  const spaceCount = (text.match(/\s/g) ?? []).length
  const spaceRatio = spaceCount / text.length
  
  if (spaceRatio > 0.05 && spaceRatio < 0.3) {
    score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * 画像品質による影響スコアを計算
 */
function calculateImageQualityImpact(imageInfo?: {
  width?: number
  height?: number
  sizeBytes: number
  processingTimeMs?: number
}): number {
  if (!imageInfo) {
    return 0.5 // デフォルト値
  }

  let score = 0.5

  // 画像解像度による影響
  if (imageInfo.width && imageInfo.height) {
    const totalPixels = imageInfo.width * imageInfo.height
    
    if (totalPixels > 1000000) { // 1MP以上
      score += 0.2
    } else if (totalPixels < 100000) { // 0.1MP未満
      score -= 0.2
    }
  }

  // ファイルサイズによる影響
  const sizeMB = imageInfo.sizeBytes / (1024 * 1024)
  if (sizeMB > 1 && sizeMB < 10) {
    score += 0.1
  } else if (sizeMB > 20) {
    score -= 0.1
  }

  // 処理時間による影響（間接的な品質指標）
  if (imageInfo.processingTimeMs) {
    if (imageInfo.processingTimeMs > 10000) { // 10秒以上
      score -= 0.1 // 処理に時間がかかりすぎている場合は品質低下の可能性
    }
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * 日本語文字比率を計算
 */
function calculateJapaneseCharacterRatio(text: string): number {
  const hiraganaCount = (text.match(HIRAGANA_REGEX) ?? []).length
  const katakanaCount = (text.match(KATAKANA_REGEX) ?? []).length
  const kanjiCount = (text.match(KANJI_REGEX) ?? []).length
  const punctuationCount = (text.match(JAPANESE_PUNCTUATION_REGEX) ?? []).length
  
  const japaneseCharCount = hiraganaCount + katakanaCount + kanjiCount + punctuationCount
  
  return text.length > 0 ? japaneseCharCount / text.length : 0
}

/**
 * 文字化け指標を検出
 */
function detectCorruptionIndicators(text: string): string[] {
  const indicators: string[] = []

  for (let i = 0; i < CORRUPTION_INDICATORS.length; i++) {
    if (CORRUPTION_INDICATORS[i].test(text)) {
      switch (i) {
        case 0:
          indicators.push('unicode-replacement-chars')
          break
        case 1:
          indicators.push('non-japanese-chars')
          break
        case 2:
          indicators.push('repeated-chars')
          break
        case 3:
          indicators.push('long-alphabet-strings')
          break
        case 4:
          indicators.push('long-number-strings')
          break
      }
    }
  }

  return indicators
}

/**
 * 構造的指標を検出
 */
function detectStructuralIndicators(text: string): string[] {
  const indicators: string[] = []

  if (text.includes('\n')) {
    indicators.push('multi-line')
  }
  
  if (JAPANESE_PUNCTUATION_REGEX.test(text)) {
    indicators.push('punctuation-present')
  }
  
  if (/[a-zA-Z]/.test(text)) {
    indicators.push('mixed-scripts')
  }
  
  if (/\d/.test(text)) {
    indicators.push('contains-numbers')
  }

  return indicators
}

/**
 * 総合信頼度レベルを決定
 */
function determineConfidenceLevel(score: number): 'very-high' | 'high' | 'medium' | 'low' | 'very-low' {
  if (score >= 0.9) return 'very-high'
  if (score >= 0.75) return 'high'
  if (score >= 0.5) return 'medium'
  if (score >= 0.25) return 'low'
  return 'very-low'
}