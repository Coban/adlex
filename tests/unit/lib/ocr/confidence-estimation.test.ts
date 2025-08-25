/**
 * OCR信頼度推定機能のテスト
 */

import { describe, it, expect } from 'vitest'

import { estimateOcrConfidence } from '@/lib/ocr/confidence-estimation'

describe('OCR Confidence Estimation', () => {
  describe('estimateOcrConfidence', () => {
    it('should return very low confidence for empty text', () => {
      const result = estimateOcrConfidence('')
      
      expect(result.overallScore).toBe(0)
      expect(result.level).toBe('very-low')
      expect(result.factors.textQuality).toBe(0)
      expect(result.factors.japaneseTextQuality).toBe(0)
      expect(result.details.characterCount).toBe(0)
      expect(result.details.corruptionIndicators).toContain('empty-text')
    })

    it('should score high-quality Japanese text highly', () => {
      const highQualityText = 'このサプリメントは健康維持にお役立ていただけます。毎日の健康をサポートし、バランスの取れた食事と組み合わせることで、より良い結果が期待できます。'
      
      const result = estimateOcrConfidence(highQualityText)
      
      expect(result.overallScore).toBeGreaterThan(0.7)
      expect(result.level).toBe('high')
      expect(result.factors.japaneseTextQuality).toBeGreaterThan(0.8)
      expect(result.details.japaneseCharacterRatio).toBeGreaterThan(0.8)
    })

    it('should detect text corruption indicators', () => {
      const corruptedText = 'テスト���ああああああああああああああ1234567890123456789012345'
      
      const result = estimateOcrConfidence(corruptedText)
      
      expect(result.overallScore).toBeLessThan(0.5)
      expect(result.details.corruptionIndicators).toContain('unicode-replacement-chars')
      expect(result.details.corruptionIndicators).toContain('repeated-chars')
      expect(result.details.corruptionIndicators).toContain('long-number-strings')
    })

    it('should handle mixed Japanese and English text appropriately', () => {
      const mixedText = 'このProductは健康に良いSupplementです。Daily useで効果が期待できます。'
      
      const result = estimateOcrConfidence(mixedText)
      
      expect(result.overallScore).toBeGreaterThan(0.5)
      expect(result.details.structuralIndicators).toContain('mixed-scripts')
      expect(result.factors.japaneseTextQuality).toBeGreaterThan(0.5)
    })

    it('should consider structural quality indicators', () => {
      const structuredText = `製品名：健康サプリメント
効果：健康維持をサポート
使用方法：1日2錠を目安に

注意事項：
・医師にご相談ください
・子供の手の届かない場所に保管`

      const result = estimateOcrConfidence(structuredText)
      
      expect(result.factors.structuralQuality).toBeGreaterThan(0.5)
      expect(result.details.structuralIndicators).toContain('multi-line')
      expect(result.details.structuralIndicators).toContain('punctuation-present')
    })

    it('should factor in image quality when provided', () => {
      const text = 'テストテキスト'
      
      const highQualityImage = {
        width: 2000,
        height: 1500,
        sizeBytes: 2 * 1024 * 1024, // 2MB
        processingTimeMs: 3000
      }
      
      const lowQualityImage = {
        width: 200,
        height: 150,
        sizeBytes: 50 * 1024, // 50KB
        processingTimeMs: 15000
      }
      
      const highQualityResult = estimateOcrConfidence(text, highQualityImage)
      const lowQualityResult = estimateOcrConfidence(text, lowQualityImage)
      
      expect(highQualityResult.factors.imageQualityImpact)
        .toBeGreaterThan(lowQualityResult.factors.imageQualityImpact)
    })

    it('should correctly classify confidence levels', () => {
      // Very high confidence text
      const veryHighText = 'この製品は健康維持にお役立ていただけます。バランスの取れた食事と適度な運動と組み合わせることで、より良い結果が期待できます。'
      const veryHighResult = estimateOcrConfidence(veryHighText)
      expect(veryHighResult.level).toBe('high') // 実際は'very-high'になる可能性もある

      // Low confidence text
      const lowText = 'aaaaabbbbccccdddd123456789���'
      const lowResult = estimateOcrConfidence(lowText)
      expect(['low', 'very-low']).toContain(lowResult.level)
    })

    it('should handle katakana-heavy text', () => {
      const katakanaText = 'サプリメント、ビタミン、ミネラル、プロテイン'
      
      const result = estimateOcrConfidence(katakanaText)
      
      expect(result.factors.japaneseTextQuality).toBeGreaterThan(0.5)
      expect(result.details.japaneseCharacterRatio).toBeGreaterThan(0.8)
    })

    it('should handle kanji-heavy text', () => {
      const kanjiText = '健康維持、栄養補助、免疫機能、消化吸収'
      
      const result = estimateOcrConfidence(kanjiText)
      
      expect(result.factors.japaneseTextQuality).toBeGreaterThan(0.5)
      expect(result.details.japaneseCharacterRatio).toBeGreaterThan(0.8)
    })

    it('should detect number-containing text', () => {
      const textWithNumbers = '1日2錠、30日分、価格は1980円です。'
      
      const result = estimateOcrConfidence(textWithNumbers)
      
      expect(result.details.structuralIndicators).toContain('contains-numbers')
    })

    it('should handle very short text appropriately', () => {
      const shortText = 'テスト'
      
      const result = estimateOcrConfidence(shortText)
      
      // 短いテキストでも完全に0にはならない
      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThan(0.8)
    })

    it('should handle very long text', () => {
      const longText = 'テスト'.repeat(2000) // 8000文字
      
      const result = estimateOcrConfidence(longText)
      
      // 長すぎるテキストは品質低下の可能性
      expect(result.factors.textQuality).toBeLessThan(1.0)
    })
  })
})