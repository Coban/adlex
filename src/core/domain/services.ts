import { DictionaryItem, Violation, Organization, OrganizationUsage } from './entities'
import { EmbeddingVector, TextRange } from './valueObjects'

/**
 * 薬機法チェックドメインサービス
 * 違反検出の複雑なビジネスルールを実装
 */
export class PharmaceuticalLawCheckService {
  /**
   * テキストに対して辞書項目での違反チェックを実行
   */
  static checkViolations(
    inputText: string,
    dictionaryItems: DictionaryItem[],
    _similarityThreshold = 0.75
  ): ViolationCandidate[] {
    const violations: ViolationCandidate[] = []
    const ngPhrases = dictionaryItems.filter(item => item.isNGPhrase())
    
    // 1. 完全一致チェック
    for (const ngPhrase of ngPhrases) {
      const exactMatches = this.findExactMatches(inputText, ngPhrase.phrase)
      for (const match of exactMatches) {
        violations.push({
          dictionaryItem: ngPhrase,
          range: match,
          matchType: 'exact',
          confidence: 1.0,
          originalText: match.extractFromText(inputText)
        })
      }
    }

    // 2. 部分一致チェック（短縮形、活用形など）
    for (const ngPhrase of ngPhrases) {
      const partialMatches = this.findPartialMatches(inputText, ngPhrase.phrase)
      for (const match of partialMatches) {
        // 既に完全一致で検出されている場合はスキップ
        if (!violations.some(v => v.range.overlaps(match))) {
          violations.push({
            dictionaryItem: ngPhrase,
            range: match,
            matchType: 'partial',
            confidence: 0.8,
            originalText: match.extractFromText(inputText)
          })
        }
      }
    }

    return violations
  }

  /**
   * 完全一致の検索
   */
  private static findExactMatches(text: string, phrase: string): TextRange[] {
    const ranges: TextRange[] = []
    const normalizedText = text.toLowerCase()
    const normalizedPhrase = phrase.toLowerCase()
    
    let startIndex = 0
    while (true) {
      const index = normalizedText.indexOf(normalizedPhrase, startIndex)
      if (index === -1) break
      
      ranges.push(TextRange.create(index, index + phrase.length))
      startIndex = index + 1
    }
    
    return ranges
  }

  /**
   * 部分一致の検索（単語境界を考慮）
   */
  private static findPartialMatches(text: string, phrase: string): TextRange[] {
    const ranges: TextRange[] = []
    
    // 単語境界を考慮した部分マッチング
    // 実際の実装では形態素解析などを使用することが望ましい
    const words = phrase.split(/\s+/)
    const mainWord = words[0] // メインキーワード
    
    if (mainWord.length < 3) return ranges // 短すぎる場合はスキップ
    
    const regex = new RegExp(`\\b${this.escapeRegExp(mainWord)}`, 'gi')
    let match
    
    while ((match = regex.exec(text)) !== null) {
      ranges.push(TextRange.create(match.index, match.index + match[0].length))
    }
    
    return ranges
  }

  /**
   * 正規表現用エスケープ
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * ベクトル類似度による類似表現チェック
   */
  static async checkSimilarExpressions(
    inputVector: EmbeddingVector,
    dictionaryItems: DictionaryItem[],
    threshold = 0.75
  ): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = []
    
    for (const item of dictionaryItems) {
      if (!item.hasEmbedding()) continue
      
      const itemVector = EmbeddingVector.create(item.vector!)
      const similarity = inputVector.cosineSimilarity(itemVector)
      
      if (similarity >= threshold) {
        matches.push({
          dictionaryItem: item,
          similarity,
          isNGPhrase: item.isNGPhrase()
        })
      }
    }
    
    // 類似度の降順でソート
    return matches.sort((a, b) => b.similarity - a.similarity)
  }
}

/**
 * 組織制限管理ドメインサービス
 */
export class OrganizationLimitService {
  /**
   * 組織が使用制限内かチェック
   */
  static checkUsageLimits(organization: Organization, currentUsage: OrganizationUsage): UsageLimitResult {
    const violations: string[] = []
    
    if (currentUsage.monthlyChecks > organization.limits.monthlyChecks) {
      violations.push(`月間チェック数が制限を超えています (${currentUsage.monthlyChecks}/${organization.limits.monthlyChecks})`)
    }
    
    if (currentUsage.totalUsers > organization.limits.totalUsers) {
      violations.push(`ユーザー数が制限を超えています (${currentUsage.totalUsers}/${organization.limits.totalUsers})`)
    }
    
    if (currentUsage.totalDictionaries > organization.limits.totalDictionaries) {
      violations.push(`辞書項目数が制限を超えています (${currentUsage.totalDictionaries}/${organization.limits.totalDictionaries})`)
    }
    
    if (currentUsage.storageUsedGB > organization.limits.storageGB) {
      violations.push(`ストレージ使用量が制限を超えています (${currentUsage.storageUsedGB}GB/${organization.limits.storageGB}GB)`)
    }
    
    return {
      isWithinLimits: violations.length === 0,
      violations,
      usage: currentUsage,
      limits: organization.limits
    }
  }

  /**
   * アクションが実行可能かチェック
   */
  static canPerformAction(
    organization: Organization, 
    currentUsage: OrganizationUsage, 
    action: OrganizationAction
  ): boolean {
    switch (action.type) {
      case 'create_check':
        return currentUsage.monthlyChecks < organization.limits.monthlyChecks
      
      case 'invite_user':
        return currentUsage.totalUsers < organization.limits.totalUsers
      
      case 'create_dictionary':
        return currentUsage.totalDictionaries < organization.limits.totalDictionaries
      
      default:
        return true
    }
  }
}

/**
 * チェック処理ドメインサービス
 */
export class CheckProcessingService {
  /**
   * チェック結果からサマリーを生成
   */
  static generateCheckSummary(violations: Violation[]): CheckSummary {
    const totalViolations = violations.length
    
    // 違反の重複を除去（同じ辞書項目による重複）
    const violationsByDictionary = new Map<number, Violation[]>()
    violations.forEach(v => {
      if (v.dictionaryId !== null) {
        if (!violationsByDictionary.has(v.dictionaryId)) {
          violationsByDictionary.set(v.dictionaryId, [])
        }
        violationsByDictionary.get(v.dictionaryId)!.push(v)
      }
    })

    return {
      totalViolations,
      uniqueViolations: violationsByDictionary.size,
      hasViolations: totalViolations > 0,
      violationsByType: this.categorizeViolations(violations),
      riskLevel: this.calculateRiskLevel(totalViolations)
    }
  }

  /**
   * 違反をタイプ別に分類
   */
  private static categorizeViolations(violations: Violation[]): Record<string, number> {
    // 実際の実装では辞書項目のカテゴリーや重要度に基づいて分類
    return {
      '効能・効果': violations.filter(v => v.originalText.includes('効く') || v.originalText.includes('治る')).length,
      '安全性': violations.filter(v => v.originalText.includes('安全') || v.originalText.includes('副作用なし')).length,
      '最上級表現': violations.filter(v => v.originalText.includes('最高') || v.originalText.includes('No.1')).length,
      'その他': violations.filter(v => !this.isKnownCategory(v.originalText)).length
    }
  }

  private static isKnownCategory(text: string): boolean {
    const knownPatterns = ['効く', '治る', '安全', '副作用なし', '最高', 'No.1']
    return knownPatterns.some(pattern => text.includes(pattern))
  }

  /**
   * リスクレベルの計算
   */
  private static calculateRiskLevel(violationCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (violationCount === 0) return 'low'
    if (violationCount <= 2) return 'medium'
    if (violationCount <= 5) return 'high'
    return 'critical'
  }
}

// Type definitions
export interface ViolationCandidate {
  dictionaryItem: DictionaryItem
  range: TextRange
  matchType: 'exact' | 'partial'
  confidence: number
  originalText: string
}

export interface SimilarityMatch {
  dictionaryItem: DictionaryItem
  similarity: number
  isNGPhrase: boolean
}

export interface UsageLimitResult {
  isWithinLimits: boolean
  violations: string[]
  usage: OrganizationUsage
  limits: { monthlyChecks: number; totalUsers: number; totalDictionaries: number; storageGB: number }
}

export interface OrganizationAction {
  type: 'create_check' | 'invite_user' | 'create_dictionary' | 'other'
  metadata?: Record<string, unknown>
}

export interface CheckSummary {
  totalViolations: number
  uniqueViolations: number
  hasViolations: boolean
  violationsByType: Record<string, number>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}