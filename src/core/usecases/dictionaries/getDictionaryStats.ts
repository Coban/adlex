import { RepositoryContainer } from '@/core/ports'

/**
 * 辞書統計取得のユースケース入力
 */
export interface GetDictionaryStatsInput {
  userId: string
}

/**
 * 使用頻度統計項目
 */
export interface TopUsedItem {
  dictionary_id: number
  count: number
  phrase: string
}

/**
 * 辞書統計取得のユースケース出力
 */
export interface GetDictionaryStatsOutput {
  totals: {
    total: number
    ng: number
    allow: number
  }
  topUsed: TopUsedItem[]
  since: string
}

/**
 * 辞書統計取得のユースケース結果
 */
export type GetDictionaryStatsResult = 
  | { success: true; data: GetDictionaryStatsOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書統計取得ユースケース
 */
export class GetDictionaryStatsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetDictionaryStatsInput): Promise<GetDictionaryStatsResult> {
    try {
      // ユーザーの認証・認可チェック
      const authResult = await this.checkUserAuth(input.userId)
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error
        }
      }

      const { user, organizationId } = authResult.data

      // 管理者権限チェック
      if (user.role !== "admin") {
        return {
          success: false,
          error: { code: 'FORBIDDEN_ERROR', message: '管理者権限が必要です' }
        }
      }

      // 辞書統計の取得
      const stats = await this.getDictionaryStats(organizationId)
      
      return {
        success: true,
        data: stats
      }

    } catch (error) {
      console.error('Get dictionary stats usecase error:', error)
      
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '辞書統計の取得に失敗しました' }
      }
    }
  }

  /**
   * ユーザー認証・認可チェック
   */
  private async checkUserAuth(userId: string): Promise<{
    success: true
    data: { user: { id: string; organization_id: number | null; role: string | null }; organizationId: number }
  } | {
    success: false
    error: { code: string; message: string }
  }> {
    try {
      const user = await this.repositories.users.findById(userId)
      if (!user?.organization_id) {
        return {
          success: false,
          error: { code: 'NOT_FOUND_ERROR', message: 'ユーザープロファイルが見つかりません' }
        }
      }

      return {
        success: true,
        data: { user, organizationId: user.organization_id }
      }
    } catch {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'ユーザー情報の取得に失敗しました' }
      }
    }
  }

  /**
   * 辞書統計の取得
   */
  private async getDictionaryStats(organizationId: number): Promise<GetDictionaryStatsOutput> {
    // Totals by category
    const dicts = await this.repositories.dictionaries.findByOrganizationId(organizationId)
    
    const total = dicts.length
    const ng = dicts.filter(d => d.category === 'NG').length
    const allow = total - ng

    // 使用頻度（最近30日）の上位10件: violationsを集計
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sinceIso = sinceDate.toISOString()
    
    const checks = await this.repositories.checks.findMany({
      where: {
        organization_id: organizationId,
        created_at: {
          operator: 'gte',
          value: sinceIso
        }
      }
    })

    const checkIds = checks.map(c => c.id)
    let topUsed: TopUsedItem[] = []

    if (checkIds.length > 0) {
      // Get all violations for these checks
      const allViolations = await Promise.all(
        checkIds.map(checkId => this.repositories.violations.findByCheckId(checkId))
      )
      const violations = allViolations.flat()

      // Count violations by dictionary_id
      const counts = new Map<number, number>()
      for (const v of violations) {
        if (!v.dictionary_id) continue
        counts.set(v.dictionary_id, (counts.get(v.dictionary_id) ?? 0) + 1)
      }

      // Sort by count and take top 10
      const entries = Array.from(counts.entries())
        .map(([dictionary_id, count]) => ({ dictionary_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      if (entries.length > 0) {
        // Get phrases for these dictionary IDs
        const dictIds = entries.map(e => e.dictionary_id)
        const phraseRows = await Promise.all(
          dictIds.map(id => this.repositories.dictionaries.findById(id))
        )
        
        const idToPhrase = new Map<number, string>()
        for (const r of phraseRows) {
          if (r) idToPhrase.set(r.id, r.phrase)
        }
        
        topUsed = entries.map(e => ({ 
          ...e, 
          phrase: idToPhrase.get(e.dictionary_id) ?? '' 
        }))
      }
    }

    return {
      totals: { total, ng, allow },
      topUsed,
      since: sinceIso,
    }
  }
}