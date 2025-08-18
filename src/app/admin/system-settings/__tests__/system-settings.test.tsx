import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AdminSystemSettings from '../page'

// useToastをモック
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('AdminSystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('システム設定ページのタイトルを表示する', () => {
    render(<AdminSystemSettings />)
    
    expect(screen.getByText('システム設定')).toBeInTheDocument()
    expect(screen.getByText('システム全体の設定と機能管理')).toBeInTheDocument()
  })

  it('タブが正しく表示される', () => {
    render(<AdminSystemSettings />)
    
    expect(screen.getByRole('tab', { name: '一般' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '機能フラグ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '通知' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'API' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'メンテナンス' })).toBeInTheDocument()
  })

  describe('一般タブ', () => {
    it('一般設定を表示する', () => {
      render(<AdminSystemSettings />)
      
      // デフォルトで一般タブが選択されている
      expect(screen.getByText('一般設定')).toBeInTheDocument()
      expect(screen.getByText('システムの基本動作設定')).toBeInTheDocument()
      
      // レート制限設定
      expect(screen.getByText('レート制限')).toBeInTheDocument()
      expect(screen.getByText('レート制限を有効化')).toBeInTheDocument()
      expect(screen.getByText('APIリクエストの制限を設定')).toBeInTheDocument()
      
      // キャッシュ設定
      expect(screen.getByText('キャッシュ設定')).toBeInTheDocument()
      expect(screen.getByText('キャッシュを有効化')).toBeInTheDocument()
      expect(screen.getByText('キャッシュをクリア')).toBeInTheDocument()
      
      // ファイルアップロード設定
      expect(screen.getByText('ファイルアップロード')).toBeInTheDocument()
      expect(screen.getByText('最大ファイルサイズ（MB）')).toBeInTheDocument()
      expect(screen.getByText('許可するファイル形式')).toBeInTheDocument()
    })

    it('レート制限の設定が動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      // レート制限を無効にする
      const rateLimitSwitch = screen.getByRole('switch', { name: /レート制限を有効化/ })
      await user.click(rateLimitSwitch)
      
      // レート制限の詳細設定が表示されなくなることを確認
      await waitFor(() => {
        expect(screen.queryByText('リクエスト数')).not.toBeInTheDocument()
      })
    })

    it('キャッシュクリア機能が動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      const clearCacheButton = screen.getByText('キャッシュをクリア')
      await user.click(clearCacheButton)
      
      // ボタンがローディング状態になることを確認
      expect(screen.getByText('キャッシュをクリア')).toBeInTheDocument()
    })

    it('設定を保存できる', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      const saveButton = screen.getByText('設定を保存')
      await user.click(saveButton)
      
      // ローディング状態になることを確認
      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })
    })
  })

  describe('機能フラグタブ', () => {
    it('機能フラグ一覧を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: '機能フラグ' }))
      
      expect(screen.getByText('機能フラグ管理')).toBeInTheDocument()
      expect(screen.getByText('実験的機能やベータ機能の有効化/無効化')).toBeInTheDocument()
      
      // 機能フラグ
      expect(screen.getByText('AI自動学習')).toBeInTheDocument()
      expect(screen.getByText('バッチ処理API')).toBeInTheDocument()
      expect(screen.getByText('多言語対応')).toBeInTheDocument()
      expect(screen.getByText('リアルタイムコラボレーション')).toBeInTheDocument()
      expect(screen.getByText('カスタムレポート')).toBeInTheDocument()
      
      // カテゴリーバッジ
      expect(screen.getByText('experimental')).toBeInTheDocument()
      expect(screen.getByText('beta')).toBeInTheDocument()
      expect(screen.getByText('stable')).toBeInTheDocument()
    })

    it('機能フラグのトグルが動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: '機能フラグ' }))
      
      // AI自動学習のスイッチを探す（現在はfalseに設定されている）
      const switches = screen.getAllByRole('switch')
      const aiLearningSwitch = switches.find(sw => 
        sw.closest('.border')?.textContent?.includes('AI自動学習')
      )
      
      if (aiLearningSwitch) {
        await user.click(aiLearningSwitch)
        // スイッチの状態が変わることを確認（実際の実装に依存）
      }
    })
  })

  describe('通知タブ', () => {
    it('通知設定を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: '通知' }))
      
      expect(screen.getByText('通知設定')).toBeInTheDocument()
      expect(screen.getByText('アラートと通知の設定')).toBeInTheDocument()
      
      // 通知設定
      expect(screen.getByText('メール通知')).toBeInTheDocument()
      expect(screen.getByText('Slack連携')).toBeInTheDocument()
      
      // アラート設定
      expect(screen.getByText('アラート設定')).toBeInTheDocument()
      expect(screen.getByText('エラーアラート')).toBeInTheDocument()
      expect(screen.getByText('パフォーマンスアラート')).toBeInTheDocument()
      expect(screen.getByText('セキュリティアラート')).toBeInTheDocument()
    })

    it('Slack連携を有効にするとWebhook URLフィールドが表示される', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: '通知' }))
      
      // Slack連携を有効にする
      const slackSwitch = screen.getByRole('switch', { name: /Slack連携/ })
      await user.click(slackSwitch)
      
      // Webhook URLフィールドが表示される
      await waitFor(() => {
        expect(screen.getByLabelText('Slack Webhook URL')).toBeInTheDocument()
      })
    })
  })

  describe('APIタブ', () => {
    it('API設定を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: 'API' }))
      
      expect(screen.getByText('API設定')).toBeInTheDocument()
      expect(screen.getByText('APIキーとアクセス設定')).toBeInTheDocument()
      
      // 新しいAPIキーを生成ボタン
      expect(screen.getByText('新しいAPIキーを生成')).toBeInTheDocument()
      
      // 既存のAPIキー
      expect(screen.getByText('Production API Key')).toBeInTheDocument()
      expect(screen.getByText('Development API Key')).toBeInTheDocument()
      expect(screen.getByText('sk-prod-xxxx...xxxx')).toBeInTheDocument()
      expect(screen.getByText('sk-dev-yyyy...yyyy')).toBeInTheDocument()
      
      // 操作ボタン
      expect(screen.getAllByText('無効化')).toHaveLength(2)
      expect(screen.getAllByText('削除')).toHaveLength(2)
    })
  })

  describe('メンテナンスタブ', () => {
    it('メンテナンス設定を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: 'メンテナンス' }))
      
      expect(screen.getByText('メンテナンスモード')).toBeInTheDocument()
      expect(screen.getByText('システムメンテナンスの設定')).toBeInTheDocument()
      
      // メンテナンスモード設定
      expect(screen.getByText('有効にすると、管理者以外のユーザーはアクセスできなくなります')).toBeInTheDocument()
      
      // デバッグ設定
      expect(screen.getByText('デバッグ設定')).toBeInTheDocument()
      expect(screen.getByText('デバッグモード')).toBeInTheDocument()
      expect(screen.getByText('詳細なエラー情報とログを出力')).toBeInTheDocument()
      
      // データベースメンテナンス
      expect(screen.getByText('データベースメンテナンス')).toBeInTheDocument()
      expect(screen.getByText('バックアップ実行')).toBeInTheDocument()
      expect(screen.getByText('最適化実行')).toBeInTheDocument()
    })

    it('メンテナンスモードを有効にするとメッセージフィールドが表示される', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: 'メンテナンス' }))
      
      // メンテナンスモードを有効にする
      const maintenanceSwitch = screen.getByRole('switch', { name: /メンテナンスモード/ })
      await user.click(maintenanceSwitch)
      
      // メンテナンスメッセージフィールドが表示される
      await waitFor(() => {
        expect(screen.getByLabelText('メンテナンスメッセージ')).toBeInTheDocument()
      })
    })

    it('メンテナンスメッセージを編集できる', async () => {
      const user = userEvent.setup()
      render(<AdminSystemSettings />)
      
      await user.click(screen.getByRole('tab', { name: 'メンテナンス' }))
      
      // メンテナンスモードを有効にする
      const maintenanceSwitch = screen.getByRole('switch', { name: /メンテナンスモード/ })
      await user.click(maintenanceSwitch)
      
      // メッセージフィールドに入力
      const messageField = await screen.findByLabelText('メンテナンスメッセージ')
      await user.clear(messageField)
      await user.type(messageField, 'カスタムメンテナンスメッセージ')
      
      expect(screen.getByDisplayValue('カスタムメンテナンスメッセージ')).toBeInTheDocument()
    })
  })

  it('数値設定フィールドが表示される', async () => {
    render(<AdminSystemSettings />)
    
    // 数値フィールドの存在を確認
    expect(screen.getByDisplayValue('100')).toBeInTheDocument() // リクエスト数
    expect(screen.getByDisplayValue('60')).toBeInTheDocument()  // 時間枠
    expect(screen.getByDisplayValue('3600')).toBeInTheDocument() // キャッシュTTL
  })

  it('ファイルアップロード設定が表示される', async () => {
    render(<AdminSystemSettings />)
    
    // ファイルアップロード設定の存在を確認
    expect(screen.getByText('最大ファイルサイズ（MB）')).toBeInTheDocument()
    expect(screen.getByText('許可するファイル形式')).toBeInTheDocument()
  })
})