import { RepositoryContainer } from '@/core/ports'
import { embeddingQueue } from "@/lib/embedding-queue";

/**
 * 埋め込み統計取得のユースケース入力
 */
export interface GetEmbeddingStatsInput {
  userId: string
  jobId?: string
}

/**
 * ジョブ進捗データ
 */
export interface JobProgress {
  id: string
  status: string
  total: number
  completed: number
  failed: number
  progress: number
}

/**
 * 埋め込み統計データ
 */
export interface EmbeddingStats {
  organizationId: number
  totalItems: number
  itemsWithEmbedding: number
  itemsWithoutEmbedding: number
  embeddingCoverageRate: number
}

/**
 * 埋め込み統計取得のユースケース出力
 */
export type GetEmbeddingStatsOutput = JobProgress | EmbeddingStats

/**
 * 埋め込み統計取得のユースケース結果
 */
export type GetEmbeddingStatsResult = 
  | { success: true; data: GetEmbeddingStatsOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 埋め込み統計取得ユースケース
 */
export class GetEmbeddingStatsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: GetEmbeddingStatsInput): Promise<GetEmbeddingStatsResult> {
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

      // ジョブ進捗の問い合わせ
      if (input.jobId) {
        return this.getJobProgress(input.jobId)
      }

      // 組織の辞書項目のembedding統計を取得
      return this.getOrganizationStats(organizationId)

    } catch (error) {
      console.error('Get embedding stats usecase error:', error)
      
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '統計情報の取得に失敗しました' }
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
      // ユーザープロファイルと組織情報を取得
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
   * ジョブ進捗取得
   */
  private getJobProgress(jobId: string): GetEmbeddingStatsResult {
    const job = embeddingQueue.getJob(jobId)
    if (!job) {
      return {
        success: false,
        error: { code: 'NOT_FOUND_ERROR', message: '指定されたジョブが見つかりません' }
      }
    }
    
    return {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        total: job.total,
        completed: job.processed,
        failed: job.failure,
        progress: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
      }
    }
  }

  /**
   * 組織の埋め込み統計取得
   */
  private async getOrganizationStats(organizationId: number): Promise<GetEmbeddingStatsResult> {
    try {
      // 組織の辞書項目を取得（vectorフィールド含む）
      const dictionaries = await this.repositories.dictionaries.findByOrganizationId(organizationId)

      const totalItems = dictionaries.length
      const itemsWithEmbedding = dictionaries.filter((item) => item.vector !== null).length
      const itemsWithoutEmbedding = totalItems - itemsWithEmbedding

      return {
        success: true,
        data: {
          organizationId,
          totalItems,
          itemsWithEmbedding,
          itemsWithoutEmbedding,
          embeddingCoverageRate: totalItems > 0
            ? Math.round((itemsWithEmbedding / totalItems) * 100)
            : 0,
        }
      }
    } catch (error) {
      console.error("Organization stats error:", error)
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '組織統計の取得に失敗しました' }
      }
    }
  }
}