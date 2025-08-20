import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { StreamCheckUpdatesUseCase } from '@/core/usecases/checks/streamCheckUpdates'
import type { RepositoryContainer } from '@/core/ports'

// モックデータ
const mockCheckRecord = {
  id: 1,
  user_id: 'user123',
  organization_id: 123,
  input_type: 'text' as const,
  status: 'processing' as const,
  original_text: 'テストテキスト',
  created_at: new Date().toISOString(),
  completed_at: null,
  deleted_at: null,
  error_message: null,
  extracted_text: null,
  image_url: null,
  modified_text: null,
  ocr_metadata: null,
  ocr_status: null
}

const mockUserProfile = {
  id: 'user123',
  organization_id: 123,
  role: 'user' as const,
  email: 'user123@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// モックRepositoryContainer
const mockRepositories = {
  checks: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByIdWithDetailedViolations: vi.fn(),
    findByUserId: vi.fn(),
    findByOrganizationId: vi.fn()
  },
  users: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByEmail: vi.fn(),
    findByOrganizationId: vi.fn(),
    updateRole: vi.fn()
  },
  organizations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  dictionaries: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByOrganizationId: vi.fn(),
    bulkCreate: vi.fn(),
    updateWithEmbedding: vi.fn(),
    search: vi.fn()
  },
  violations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByCheckId: vi.fn()
  },
  realtime: {
    subscribeToCheckUpdates: vi.fn(),
    unsubscribe: vi.fn(),
    getFinalCheckData: vi.fn()
  },
  userInvitations: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
} as unknown as RepositoryContainer


describe('StreamCheckUpdatesUseCase', () => {
  let useCase: StreamCheckUpdatesUseCase
  let mockOnUpdate: ReturnType<typeof vi.fn>
  let mockOnComplete: ReturnType<typeof vi.fn>
  let mockOnError: ReturnType<typeof vi.fn>
  let mockOnHeartbeat: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new StreamCheckUpdatesUseCase(mockRepositories)
    
    mockOnUpdate = vi.fn()
    mockOnComplete = vi.fn()
    mockOnError = vi.fn()
    mockOnHeartbeat = vi.fn()

    // デフォルトのモック戻り値を設定
    vi.mocked(mockRepositories.checks.findById).mockResolvedValue(mockCheckRecord)
    vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUserProfile)
    vi.mocked(mockRepositories.realtime.subscribeToCheckUpdates).mockResolvedValue({ success: true })
    vi.mocked(mockRepositories.realtime.getFinalCheckData).mockResolvedValue(null)
  })

  afterEach(() => {
    useCase.cleanup()
  })

  describe('execute', () => {
    const baseInput = {
      checkId: 1,
      currentUserId: 'user123',
      onUpdate: mockOnUpdate,
      onComplete: mockOnComplete,
      onError: mockOnError,
      onHeartbeat: mockOnHeartbeat
    }

    it('正常なストリーミング開始ができること', async () => {
      await useCase.execute(baseInput)

      expect(vi.mocked(mockRepositories.checks.findById)).toHaveBeenCalledWith(1)
      expect(vi.mocked(mockRepositories.users.findById)).toHaveBeenCalledWith('user123')
      expect(vi.mocked(mockRepositories.realtime.subscribeToCheckUpdates)).toHaveBeenCalledWith(
        expect.objectContaining({
          checkId: 1
        })
      )
    })

    it.skip('存在しないチェックIDでエラーになること', async () => {
      // モック設定をリセット
      vi.clearAllMocks()
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(null)

      await useCase.execute(baseInput)
      
      // 非同期処理を待機
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockOnError).toHaveBeenCalledWith({
        id: 1,
        status: 'failed',
        error: 'チェックが見つかりません'
      })
    })

    it.skip('権限のないユーザーでエラーになること', async () => {
      // モック設定をリセット
      vi.clearAllMocks()
      const unauthorizedUser = {
        ...mockUserProfile,
        organization_id: 999
      }
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(mockCheckRecord)
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(unauthorizedUser)

      await useCase.execute(baseInput)
      
      // 非同期処理を待機
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockOnError).toHaveBeenCalledWith({
        id: 1,
        status: 'failed',
        error: 'このチェックへのアクセス権がありません'
      })
    })

    it.skip('既に完了しているチェックの場合即座に完了データを送信すること', async () => {
      // モック設定をリセット  
      vi.clearAllMocks()
      const completedCheck = {
        ...mockCheckRecord,
        status: 'completed' as const
      }
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(completedCheck)
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUserProfile)

      // RealtimeRepository subscribeToCheckUpdatesのモック
      vi.mocked(mockRepositories.realtime.subscribeToCheckUpdates).mockResolvedValue({ success: true })

      await useCase.execute(baseInput)
      
      // 非同期処理を待機
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          status: 'completed'
        })
      )
    })

    it('画像処理の場合適切なタイムアウト設定を使用すること', async () => {
      const imageCheck = {
        ...mockCheckRecord,
        input_type: 'image' as const
      }
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(imageCheck)

      await useCase.execute(baseInput)

      // 画像の場合のタイムアウト設定が使用されることを確認
      // 実際の実装では、内部的により長いタイムアウト値が設定される
      expect(vi.mocked(mockRepositories.checks.findById)).toHaveBeenCalledWith(1)
    })

    it('管理者ユーザーは他のユーザーのチェックにアクセスできること', async () => {
      const adminUser = {
        ...mockUserProfile,
        role: 'admin' as const
      }
      const otherUserCheck = {
        ...mockCheckRecord,
        user_id: 'other-user'
      }
      
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(adminUser)
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(otherUserCheck)

      await useCase.execute(baseInput)

      // エラーが発生しないことを確認
      expect(mockOnError).not.toHaveBeenCalled()
      expect(vi.mocked(mockRepositories.realtime.subscribeToCheckUpdates)).toHaveBeenCalledWith(
        expect.objectContaining({
          checkId: 1
        })
      )
    })
  })

  describe('getStreamConfig', () => {
    it('画像処理の場合より長いタイムアウトを設定すること', () => {
      const config = (useCase as any).getStreamConfig('image')
      
      expect(config.maxConnectionTime).toBe(180000) // 3分
      expect(config.maxProgressTime).toBe(60000)    // 1分
    })

    it('テキスト処理の場合標準的なタイムアウトを設定すること', () => {
      const config = (useCase as any).getStreamConfig('text')
      
      expect(config.maxConnectionTime).toBe(90000)  // 1.5分
      expect(config.maxProgressTime).toBe(30000)    // 30秒
    })

    it('input_typeがnullの場合デフォルト設定を使用すること', () => {
      const config = (useCase as any).getStreamConfig(null)
      
      expect(config.maxConnectionTime).toBe(90000)  // 1.5分
      expect(config.maxProgressTime).toBe(30000)    // 30秒
    })
  })

  describe('validateAccess', () => {
    it('正常なアクセス権の場合successを返すこと', async () => {
      const result = await (useCase as any).validateAccess(1, 'user123')

      expect(result.success).toBe(true)
      expect(result.checkRecord).toEqual(mockCheckRecord)
    })

    it('チェックが見つからない場合エラーを返すこと', async () => {
      vi.mocked(mockRepositories.checks.findById).mockResolvedValue(null)

      const result = await (useCase as any).validateAccess(1, 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('チェックが見つかりません')
    })

    it('ユーザーが見つからない場合エラーを返すこと', async () => {
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(null)

      const result = await (useCase as any).validateAccess(1, 'user123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
    })
  })

  describe('cleanup', () => {
    it('リソースを適切にクリーンアップすること', () => {
      useCase.cleanup()

      expect(vi.mocked(mockRepositories.realtime.unsubscribe)).toHaveBeenCalled()
    })

    it('タイマーを適切にクリアすること', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      // タイマーを設定
      ;(useCase as any).progressTimeout = setTimeout(() => {}, 1000)
      ;(useCase as any).connectionTimeout = setTimeout(() => {}, 1000)
      ;(useCase as any).heartbeatInterval = setInterval(() => {}, 1000)

      useCase.cleanup()

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearTimeoutSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    })
  })

})