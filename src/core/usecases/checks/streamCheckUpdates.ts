import { RepositoryContainer } from '@/core/ports'
import { CheckUpdateData } from '@/core/ports/realtimeRepository'

/**
 * ストリーミング更新のユースケース入力
 */
export interface StreamCheckUpdatesInput {
  checkId: number
  currentUserId: string
  onUpdate: (data: StreamUpdateData) => void
  onComplete: (data: StreamCompleteData) => void
  onError: (error: StreamErrorData) => void
  onHeartbeat: (count: number) => void
  signal?: AbortSignal
}

/**
 * ストリーミング更新データ
 */
export interface StreamUpdateData {
  id: number
  status: string
  input_type?: string
  ocr_status?: string | null
  extracted_text?: string | null
  error_message?: string | null
}

/**
 * ストリーミング完了データ
 */
export interface StreamCompleteData {
  id: number
  status: string
  input_type?: string
  original_text?: string | null
  extracted_text?: string | null
  image_url?: string | null
  ocr_status?: string | null
  ocr_metadata?: Record<string, unknown> | null
  modified_text?: string | null
  violations?: Record<string, unknown>[]
  error_message?: string | null
  completed_at?: string | null
}

/**
 * ストリーミングエラーデータ
 */
export interface StreamErrorData {
  id: number
  status: 'failed'
  error: string
}

/**
 * ストリーミング設定
 */
export interface StreamConfig {
  maxConnectionTime: number
  maxProgressTime: number
  heartbeatInterval: number
  maxHeartbeats: number
}

/**
 * チェック更新ストリーミングユースケース
 * SSEによるリアルタイム更新のビジネスロジックを管理
 */
export class StreamCheckUpdatesUseCase {
  private heartbeatInterval: NodeJS.Timeout | null = null
  private progressTimeout: NodeJS.Timeout | null = null
  private connectionTimeout: NodeJS.Timeout | null = null
  private heartbeatCount = 0

  constructor(
    private repositories: RepositoryContainer
  ) {}

  /**
   * ストリーミングを開始
   */
  async execute(input: StreamCheckUpdatesInput): Promise<void> {
    try {
      // チェックレコードの存在確認とアクセス権検証
      const accessCheck = await this.validateAccess(input.checkId, input.currentUserId)
      if (!accessCheck.success) {
        if (typeof input.onError === 'function') {
          input.onError({
            id: input.checkId,
            status: 'failed',
            error: accessCheck.error ?? '認証エラーが発生しました'
          })
        }
        return
      }

      const checkRecord = accessCheck.checkRecord
      if (!checkRecord) {
        if (typeof input.onError === 'function') {
          input.onError({
            id: input.checkId,
            status: 'failed',
            error: 'チェックレコードが見つかりません'
          })
        }
        return
      }

      // ストリーミング設定を決定
      const config = this.getStreamConfig(checkRecord.input_type as string | null)

      // 既に完了している場合は即座に最終データを送信
      if (checkRecord.status === 'completed' || checkRecord.status === 'failed') {
        await this.handleCompletion(input)
        return
      }

      // リアルタイムチャンネルの設定
      await this.setupChannel(input, config)

      // タイムアウト処理の設定
      this.setupTimeouts(input, config)

      // ハートビートの開始
      this.startHeartbeat(input, config.heartbeatInterval)

      // クリーンアップ処理の設定
      if (input.signal) {
        input.signal.addEventListener('abort', () => this.cleanup())
      }

    } catch (error) {
      console.error('StreamCheckUpdatesUseCase error:', error)
      if (typeof input.onError === 'function') {
        input.onError({
          id: input.checkId,
          status: 'failed',
          error: '予期しないエラーが発生しました'
        })
      }
      this.cleanup()
    }
  }

  /**
   * アクセス権の検証
   */
  private async validateAccess(
    checkId: number,
    userId: string
  ): Promise<{ success: boolean; error?: string; checkRecord?: Record<string, unknown> }> {
    // チェックレコードの取得
    const checkRecord = await this.repositories.checks.findById(checkId)
    if (!checkRecord) {
      return { success: false, error: 'チェックが見つかりません' }
    }

    // ユーザープロファイルの取得
    const userProfile = await this.repositories.users.findById(userId)
    if (!userProfile) {
      return { success: false, error: '認証が必要です' }
    }

    // アクセス権の確認
    const hasAccess = 
      userProfile.role === 'admin' ||
      (userProfile.role === 'user' && checkRecord.user_id === userId)

    const sameOrg = userProfile.organization_id === checkRecord.organization_id

    if (!hasAccess || !sameOrg) {
      return { success: false, error: 'このチェックへのアクセス権がありません' }
    }

    return { success: true, checkRecord }
  }

  /**
   * ストリーミング設定を取得
   */
  private getStreamConfig(inputType?: string | null): StreamConfig {
    const isImage = inputType === 'image'
    return {
      maxConnectionTime: isImage ? 180000 : 90000,  // 画像: 3分、テキスト: 1.5分
      maxProgressTime: isImage ? 60000 : 30000,     // 画像: 1分、テキスト: 30秒
      heartbeatInterval: 20000,                     // 20秒
      maxHeartbeats: 4                              // 最大4回
    }
  }

  /**
   * リアルタイムチャンネルの設定
   */
  private async setupChannel(input: StreamCheckUpdatesInput, config: StreamConfig): Promise<void> {
    // RealtimeRepositoryを使用してチェック更新を購読
    const subscribeResult = await this.repositories.realtime.subscribeToCheckUpdates({
      checkId: input.checkId,
      onUpdate: (data: CheckUpdateData) => {
        // 進捗更新時の処理
        if (data.status === 'completed' || data.status === 'failed') {
          // 処理完了時
          console.log(`[SSE] Status changed to ${data.status}, calling handleCompletion for check ${input.checkId}`)
          this.handleCompletion(input)
        } else {
          // 進捗更新時
          this.resetProgressTimeout(input, config)
          if (typeof input.onUpdate === 'function') {
            input.onUpdate({
              id: data.id,
              status: data.status,
              input_type: data.input_type ?? undefined,
              ocr_status: data.ocr_status ?? undefined,
              extracted_text: data.extracted_text ?? undefined,
              error_message: data.error_message ?? undefined
            })
          }
        }
      },
      onError: (error) => {
        console.error(`[SSE] Subscription error for check ${input.checkId}:`, error)
        if (typeof input.onError === 'function') {
          input.onError({
            id: input.checkId,
            status: 'failed',
            error: error.message
          })
        }
        this.cleanup()
      }
    })

    if (!subscribeResult.success) {
      if (typeof input.onError === 'function') {
        input.onError({
          id: input.checkId,
          status: 'failed',
          error: subscribeResult.error ?? 'リアルタイム購読の開始に失敗しました'
        })
      }
      return
    }

    // 購読成功時に現在のステータスを再確認
    const currentCheck = await this.repositories.checks.findById(input.checkId)
    if (currentCheck?.status === 'completed' || currentCheck?.status === 'failed') {
      await this.handleCompletion(input)
    }
  }

  /**
   * 処理完了時の共通処理
   */
  private async handleCompletion(input: StreamCheckUpdatesInput): Promise<void> {
    console.log(`[SSE] handleCompletion called for check ${input.checkId}`)
    this.clearTimeouts()
    const finalData = await this.repositories.realtime.getFinalCheckData(input.checkId)
    console.log(`[SSE] Final data retrieved:`, finalData ? { id: finalData.id, status: finalData.status } : 'null')
    if (finalData && typeof input.onComplete === 'function') {
      console.log(`[SSE] Calling onComplete for check ${input.checkId}`)
      // FinalCheckDataをStreamCompleteDataに変換
      input.onComplete({
        id: finalData.id,
        status: finalData.status,
        input_type: finalData.input_type ?? undefined,
        original_text: finalData.original_text ?? undefined,
        extracted_text: finalData.extracted_text ?? undefined,
        image_url: finalData.image_url ?? undefined,
        ocr_status: finalData.ocr_status ?? undefined,
        ocr_metadata: finalData.ocr_metadata,
        modified_text: finalData.modified_text ?? undefined,
        violations: finalData.violations,
        error_message: finalData.error_message ?? undefined,
        completed_at: finalData.completed_at ?? undefined
      })
    }
    this.cleanup()
  }

  /**
   * タイムアウト処理の設定
   */
  private setupTimeouts(input: StreamCheckUpdatesInput, config: StreamConfig): void {
    // 進捗タイムアウト
    this.progressTimeout = setTimeout(() => {
      // 進捗がない場合はハートビート間隔を短くする
      this.adjustHeartbeatInterval(input, 10000)
    }, config.maxProgressTime)

    // 接続タイムアウト
    this.connectionTimeout = setTimeout(async () => {
      console.log(`[SSE] Connection timeout reached for check ${input.checkId}`)
      
      // タイムアウト前に最終状態をチェック
      const finalCheck = await this.repositories.checks.findById(input.checkId)
      if (finalCheck?.status === 'completed' || finalCheck?.status === 'failed') {
        await this.handleCompletion(input)
      } else {
        if (typeof input.onError === 'function') {
          input.onError({
            id: input.checkId,
            status: 'failed',
            error: 'SSE接続がタイムアウトしました（処理時間制限）'
          })
        }
      }
      this.cleanup()
    }, config.maxConnectionTime)
  }

  /**
   * ハートビートの開始
   */
  private startHeartbeat(input: StreamCheckUpdatesInput, intervalMs: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // 設定から最大ハートビート数を取得
    const config = this.getStreamConfig(input.checkId?.toString())

    this.heartbeatInterval = setInterval(() => {
      this.heartbeatCount++
      if (this.heartbeatCount > config.maxHeartbeats) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
        return
      }
      if (typeof input.onHeartbeat === 'function') {
        input.onHeartbeat(this.heartbeatCount)
      }
    }, intervalMs)
  }

  /**
   * ハートビート間隔の調整
   */
  private adjustHeartbeatInterval(input: StreamCheckUpdatesInput, intervalMs: number): void {
    this.startHeartbeat(input, intervalMs)
  }

  /**
   * 進捗タイムアウトのリセット
   */
  private resetProgressTimeout(input: StreamCheckUpdatesInput, config: StreamConfig): void {
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout)
    }
    this.progressTimeout = setTimeout(() => {
      this.adjustHeartbeatInterval(input, 10000)
    }, config.maxProgressTime)
  }

  /**
   * タイムアウトのクリア
   */
  private clearTimeouts(): void {
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout)
      this.progressTimeout = null
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }


  /**
   * クリーンアップ処理
   */
  cleanup(): void {
    console.log('[SSE] Cleaning up SSE resources')
    this.clearTimeouts()
    this.repositories.realtime.unsubscribe()
    this.heartbeatCount = 0
  }
}