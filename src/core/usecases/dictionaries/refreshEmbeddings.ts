import { Client as QStashClient } from "@upstash/qstash";

import { RepositoryContainer } from '@/core/ports'
import { embeddingQueue } from "@/lib/embedding-queue";

/**
 * 辞書埋め込みリフレッシュのユースケース入力
 */
export interface RefreshEmbeddingsInput {
  userId: string
  dictionaryIds?: number[]
}

/**
 * 辞書埋め込みリフレッシュのユースケース出力
 */
export interface RefreshEmbeddingsOutput {
  message: string
  jobId?: string
  count?: number
  total?: number
  status?: string
}

/**
 * 辞書埋め込みリフレッシュのユースケース結果
 */
export type RefreshEmbeddingsResult = 
  | { success: true; data: RefreshEmbeddingsOutput }
  | { success: false; error: { code: string; message: string } }

/**
 * 辞書埋め込みリフレッシュユースケース
 */
export class RefreshEmbeddingsUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: RefreshEmbeddingsInput): Promise<RefreshEmbeddingsResult> {
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

      // QStashが設定されていればQStashで非同期化、なければアプリ内キューにフォールバック
      const useQStash = !!process.env.QSTASH_TOKEN && !!process.env.NEXT_PUBLIC_BASE_URL

      if (useQStash) {
        return this.processWithQStash(organizationId, input.dictionaryIds)
      } else {
        return this.processWithQueue(organizationId, input.dictionaryIds)
      }

    } catch (error) {
      console.error('Refresh embeddings usecase error:', error)
      
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Embedding再生成の開始に失敗しました' }
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
   * QStashを使用した処理
   */
  private async processWithQStash(
    organizationId: number, 
    dictionaryIds?: number[]
  ): Promise<RefreshEmbeddingsResult> {
    try {
      // 送信対象の辞書項目IDを確定
      const dictionaries = await this.getDictionaries(organizationId, dictionaryIds)

      if (!dictionaries || dictionaries.length === 0) {
        return {
          success: true,
          data: { message: "対象となる辞書項目が見つかりません" }
        }
      }

      const client = new QStashClient({ token: process.env.QSTASH_TOKEN! })
      const targetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/dictionaries/embeddings/qstash`

      // 逐次キュー投入（QStash側の自動リトライに任せる）
      // バックオフ: 30s, 60s, 120s など（maxRetries 3）
      const publishPromises = dictionaries.map((d) =>
        client.publishJSON({
          url: targetUrl,
          body: {
            dictionaryId: d.id,
            organizationId: organizationId,
            phrase: d.phrase,
          },
          retries: 3,
          backoff: 30, // seconds
          method: "POST",
        })
      )
      await Promise.allSettled(publishPromises)

      return {
        success: true,
        data: { 
          message: "QStashへ再生成ジョブを投入しました", 
          count: dictionaries.length 
        }
      }
    } catch (error) {
      console.error("QStash processing error:", error)
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'QStashジョブの投入に失敗しました' }
      }
    }
  }

  /**
   * アプリ内キューを使用した処理
   */
  private async processWithQueue(
    organizationId: number, 
    dictionaryIds?: number[]
  ): Promise<RefreshEmbeddingsResult> {
    try {
      // フォールバック: アプリ内キュー
      const job = await embeddingQueue.enqueueOrganization(
        organizationId,
        Array.isArray(dictionaryIds) && dictionaryIds.length > 0 ? dictionaryIds : undefined
      )
      
      return {
        success: true,
        data: {
          message: "Embedding再生成ジョブを開始しました",
          jobId: job.id,
          total: job.total,
          status: job.status,
        }
      }
    } catch (error) {
      console.error("Queue processing error:", error)
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'キューへのジョブ投入に失敗しました' }
      }
    }
  }

  /**
   * 辞書項目を取得
   */
  private async getDictionaries(organizationId: number, dictionaryIds?: number[]) {
    try {
      if (Array.isArray(dictionaryIds) && dictionaryIds.length > 0) {
        // 指定されたIDの辞書項目を取得
        const dictionaries = []
        for (const id of dictionaryIds) {
          const dict = await this.repositories.dictionaries.findByIdAndOrganization(id, organizationId)
          if (dict) {
            dictionaries.push(dict)
          }
        }
        return dictionaries
      } else {
        // 組織の全辞書項目を取得
        return this.repositories.dictionaries.findByOrganizationId(organizationId)
      }
    } catch (error) {
      console.error("Dictionary fetch error:", error)
      throw error
    }
  }
}