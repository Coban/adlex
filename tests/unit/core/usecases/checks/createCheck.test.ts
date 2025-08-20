import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateCheckUseCase } from '@/core/usecases/checks/createCheck'
import { createMockRepositories } from '../../../../mocks/repositories'

// Mock queue manager
vi.mock('@/lib/queue-manager', () => ({
  queueManager: {
    addToQueue: vi.fn()
  }
}))

import { queueManager } from '@/lib/queue-manager'

describe('CreateCheckUseCase', () => {
  let useCase: CreateCheckUseCase
  let mockRepositories: ReturnType<typeof createMockRepositories>
  let mockQueueManager: typeof queueManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepositories = createMockRepositories()
    useCase = new CreateCheckUseCase(mockRepositories)
    mockQueueManager = queueManager
  })

  describe('正常系', () => {
    it('有効な入力でチェックが正常に作成される', async () => {
      // テストデータの準備
      const input = {
        userId: 'user-123',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'text' as const
      }

      const mockUser = {
        id: 'user-123',
        organization_id: 1,
        role: 'user' as const,
        email: 'test@example.com',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const mockCheck = {
        id: 1,
        user_id: 'user-123',
        organization_id: 1,
        original_text: 'テスト用のテキストです',
        input_type: 'text' as const,
        status: 'pending' as const,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        deleted_at: null,
        error_message: null,
        extracted_text: null,
        image_url: null,
        modified_text: null,
        ocr_metadata: null,
        ocr_status: null
      }

      // モックの設定
      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUser)
      vi.mocked(mockRepositories.checks.create).mockResolvedValue(mockCheck)
      vi.mocked(mockQueueManager.addToQueue).mockResolvedValue(undefined)

      // 実行
      const result = await useCase.execute(input)

      // 検証
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.checkId).toBe(1)
        expect(result.data.status).toBe('pending')
        expect(result.data.message).toBe('チェック処理をキューに追加しました')
      }

      expect(mockRepositories.users.findById).toHaveBeenCalledWith('user-123')
      expect(mockRepositories.checks.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        organization_id: 1,
        original_text: 'テスト用のテキストです',
        input_type: 'text',
        status: 'pending',
        created_at: expect.any(String)
      })
      expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(1, 'テスト用のテキストです', 1, 'normal', 'text')
    })

    it('ファイル名付きのチェックが正常に作成される', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'image' as const,
        fileName: 'test.jpg'
      }

      const mockUser = {
        id: 'user-123',
        organization_id: 1,
        role: 'user' as const,
        email: 'test@example.com',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const mockCheck = {
        id: 2,
        user_id: 'user-123',
        organization_id: 1,
        original_text: 'テスト用のテキストです',
        input_type: 'image' as const,
        status: 'pending' as const,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        deleted_at: null,
        error_message: null,
        extracted_text: null,
        image_url: 'test.jpg',
        modified_text: null,
        ocr_metadata: null,
        ocr_status: null
      }

      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUser)
      vi.mocked(mockRepositories.checks.create).mockResolvedValue(mockCheck)
      vi.mocked(mockQueueManager.addToQueue).mockResolvedValue(undefined)

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.checkId).toBe(2)
      }

      expect(mockRepositories.checks.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        organization_id: 1,
        original_text: 'テスト用のテキストです',
        input_type: 'image',
        status: 'pending',
        created_at: expect.any(String)
      })
    })
  })

  describe('異常系', () => {
    it('無効なユーザーIDでバリデーションエラーが返される', async () => {
      const input = {
        userId: '',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'text' as const
      }

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('ユーザーIDが無効です')
      }
    })

    it('テキストが長すぎる場合バリデーションエラーが返される', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 1,
        originalText: 'a'.repeat(10001),
        inputType: 'text' as const
      }

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('テキストが長すぎます（最大10,000文字）')
      }
    })

    it('ユーザーが存在しない場合認証エラーが返される', async () => {
      const input = {
        userId: 'nonexistent-user',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'text' as const
      }

      vi.mocked(mockRepositories.users.findById).mockResolvedValue(null)

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHENTICATION_ERROR')
        expect(result.error.message).toBe('ユーザーが見つかりません')
      }
    })

    it('ユーザーが異なる組織に属している場合認可エラーが返される', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'text' as const
      }

      const mockUser = {
        id: 'user-123',
        organization_id: 2, // 異なる組織ID
        role: 'user' as const,
        email: 'test@example.com',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUser)

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('AUTHORIZATION_ERROR')
        expect(result.error.message).toBe('組織へのアクセス権限がありません')
      }
    })

    it('キュー追加に失敗した場合適切にハンドリングされる', async () => {
      const input = {
        userId: 'user-123',
        organizationId: 1,
        originalText: 'テスト用のテキストです',
        inputType: 'text' as const
      }

      const mockUser = {
        id: 'user-123',
        organization_id: 1,
        role: 'user' as const,
        email: 'test@example.com',
        display_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const mockCheck = {
        id: 1,
        user_id: 'user-123',
        organization_id: 1,
        original_text: 'テスト用のテキストです',
        input_type: 'text' as const,
        status: 'pending' as const,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: null,
        deleted_at: null,
        error_message: null,
        extracted_text: null,
        image_url: null,
        modified_text: null,
        ocr_metadata: null,
        ocr_status: null
      }

      vi.mocked(mockRepositories.users.findById).mockResolvedValue(mockUser)
      vi.mocked(mockRepositories.checks.create).mockResolvedValue(mockCheck)
      vi.mocked(mockRepositories.checks.update).mockResolvedValue(mockCheck)
      vi.mocked(mockQueueManager.addToQueue).mockRejectedValue(new Error('Queue error'))

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('QUEUE_ERROR')
        expect(result.error.message).toBe('処理キューへの追加に失敗しました')
      }

      // チェックレコードのステータスが失敗に更新されることを確認
      expect(mockRepositories.checks.update).toHaveBeenCalledWith(1, {
        status: 'failed',
        error_message: 'キュー追加に失敗しました'
      })
    })
  })
})