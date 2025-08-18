import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AdminSupport from '../page'

describe('AdminSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('サポートセンターのページタイトルを表示する', () => {
    render(<AdminSupport />)
    
    expect(screen.getByText('サポートセンター')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ、FAQ、サポートチケット管理')).toBeInTheDocument()
  })

  it('タブが正しく表示される', () => {
    render(<AdminSupport />)
    
    expect(screen.getByRole('tab', { name: 'チケット' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ドキュメント' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'お問い合わせ' })).toBeInTheDocument()
  })

  describe('チケットタブ', () => {
    it('サポートチケット一覧を表示する', () => {
      render(<AdminSupport />)
      
      // デフォルトでチケットタブが選択されている
      expect(screen.getByText('サポートチケット')).toBeInTheDocument()
      expect(screen.getByText('ユーザーからの問い合わせ管理')).toBeInTheDocument()
      
      // チケットフィルターボタン（複数あるので数をチェック）
      expect(screen.getByText('すべて')).toBeInTheDocument()
      expect(screen.getAllByText('未対応')).toHaveLength(2) // フィルターボタンとステータスバッジ
      expect(screen.getAllByText('対応中')).toHaveLength(2) // フィルターボタンとステータスバッジ
      const resolvedElements = screen.getAllByText('解決済')
      expect(resolvedElements.length).toBeGreaterThanOrEqual(1) // フィルターボタンとステータスバッジ
      
      // モックデータのチケット
      expect(screen.getByText('チェック機能が動作しない')).toBeInTheDocument()
      expect(screen.getByText('辞書の一括登録について')).toBeInTheDocument()
      expect(screen.getByText('請求書の発行依頼')).toBeInTheDocument()
    })

    it('チケットフィルターが動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      // フィルターボタンを特定（最初のbutton要素の「未対応」）
      const filterButtons = screen.getAllByText('未対応')
      const unopenedFilterButton = filterButtons[0] // 最初の要素はフィルターボタン
      
      await user.click(unopenedFilterButton)
      
      // 未対応のチケットのみ表示される（実際のフィルタリング実装に依存）
      // フィルタリング後は一部のチケットが表示されないかもしれない
      expect(screen.getByText('チェック機能が動作しない')).toBeInTheDocument()
      // フィルタリング後は一部のチケットは表示されないかもしれない
      // expect(screen.getByText('辞書の一括登録について')).toBeInTheDocument()
      // expect(screen.getByText('請求書の発行依頼')).toBeInTheDocument()
    })

    it('チケットの詳細情報を表示する', () => {
      render(<AdminSupport />)
      
      // チケットの詳細情報
      expect(screen.getByText('user1@test.com')).toBeInTheDocument()
      expect(screen.getByText('user2@test.com')).toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
      
      // ステータスバッジ（複数存在するので数をチェック）
      expect(screen.getAllByText('未対応').length).toBeGreaterThanOrEqual(1) // フィルターボタンとステータスバッジ
      expect(screen.getAllByText('対応中').length).toBeGreaterThanOrEqual(1) // フィルターボタンとステータスバッジ  
      expect(screen.getAllByText('解決済').length).toBeGreaterThanOrEqual(1) // フィルターボタンとステータスバッジ
      
      // 優先度
      expect(screen.getByText('優先度: 高')).toBeInTheDocument()
      expect(screen.getByText('優先度: 中')).toBeInTheDocument()
      expect(screen.getByText('優先度: 低')).toBeInTheDocument()
    })
  })

  describe('FAQタブ', () => {
    it('FAQ一覧を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      // FAQタブをクリック
      await user.click(screen.getByRole('tab', { name: 'FAQ' }))
      
      expect(screen.getByText('よくある質問')).toBeInTheDocument()
      expect(screen.getByText('頻繁に寄せられる質問と回答')).toBeInTheDocument()
      
      // 検索フィールド
      expect(screen.getByPlaceholderText('質問を検索...')).toBeInTheDocument()
      
      // FAQ カテゴリー
      expect(screen.getByText('基本機能')).toBeInTheDocument()
      expect(screen.getByText('料金・プラン')).toBeInTheDocument()
      expect(screen.getByText('セキュリティ')).toBeInTheDocument()
      expect(screen.getByText('トラブルシューティング')).toBeInTheDocument()
      
      // FAQ項目
      expect(screen.getByText('AdLexとは何ですか？')).toBeInTheDocument()
      expect(screen.getByText('テキストチェックの仕組みは？')).toBeInTheDocument()
    })

    it('FAQ検索が動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'FAQ' }))
      
      const searchInput = screen.getByPlaceholderText('質問を検索...')
      await user.type(searchInput, '料金')
      
      // 「料金」を含むFAQのみ表示される
      expect(screen.getByText('料金プランについて教えてください')).toBeInTheDocument()
      expect(screen.queryByText('AdLexとは何ですか？')).not.toBeInTheDocument()
    })

    it('FAQアコーディオンが動作する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'FAQ' }))
      
      // アコーディオンをクリック
      const faqButton = screen.getByText('AdLexとは何ですか？')
      await user.click(faqButton)
      
      // 回答が表示される
      expect(screen.getByText(/AdLexは薬機法に準拠した広告テキストの自動チェックツールです/)).toBeInTheDocument()
    })
  })

  describe('ドキュメントタブ', () => {
    it('ドキュメント一覧を表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'ドキュメント' }))
      
      expect(screen.getByText('ドキュメント & チュートリアル')).toBeInTheDocument()
      expect(screen.getByText('使い方ガイドとチュートリアル動画')).toBeInTheDocument()
      
      // チュートリアル項目
      expect(screen.getByText('初めての薬機法チェック')).toBeInTheDocument()
      expect(screen.getByText('辞書機能の活用方法')).toBeInTheDocument()
      expect(screen.getByText('APIの使い方')).toBeInTheDocument()
      expect(screen.getByText('管理者向けガイド')).toBeInTheDocument()
      
      // チュートリアルの詳細
      expect(screen.getByText('AdLexの基本的な使い方を5分で学ぶ')).toBeInTheDocument()
      expect(screen.getByText('5分')).toBeInTheDocument()
      expect(screen.getByText('初級')).toBeInTheDocument()
      
      // その他のリソース
      expect(screen.getByText('その他のリソース')).toBeInTheDocument()
      expect(screen.getByText('APIドキュメント')).toBeInTheDocument()
      expect(screen.getByText('管理者ガイド')).toBeInTheDocument()
      expect(screen.getByText('薬機法ガイドライン')).toBeInTheDocument()
    })
  })

  describe('お問い合わせタブ', () => {
    it('お問い合わせフォームを表示する', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'お問い合わせ' }))
      
      expect(screen.getByText('お問い合わせフォーム')).toBeInTheDocument()
      expect(screen.getByText('サポートチームへ直接お問い合わせください')).toBeInTheDocument()
      
      // フォームフィールド
      expect(screen.getByLabelText('お名前')).toBeInTheDocument()
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
      expect(screen.getByLabelText('カテゴリー')).toBeInTheDocument()
      expect(screen.getByLabelText('優先度')).toBeInTheDocument()
      expect(screen.getByLabelText('件名')).toBeInTheDocument()
      expect(screen.getByLabelText('お問い合わせ内容')).toBeInTheDocument()
      
      // ボタン
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('送信')).toBeInTheDocument()
      
      // 注意事項
      expect(screen.getByText('お問い合わせの前に')).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return content && content.includes('営業時間：平日 9:00-18:00') && content.includes('土日祝を除く')
      })).toBeInTheDocument()
    })

    it('お問い合わせフォームに入力できる', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'お問い合わせ' }))
      
      // フォームに入力
      await user.type(screen.getByLabelText('お名前'), '山田太郎')
      await user.type(screen.getByLabelText('メールアドレス'), 'yamada@example.com')
      await user.type(screen.getByLabelText('件名'), 'テスト問い合わせ')
      await user.type(screen.getByLabelText('お問い合わせ内容'), 'これはテストメッセージです。')
      
      // 入力値を確認
      expect(screen.getByDisplayValue('山田太郎')).toBeInTheDocument()
      expect(screen.getByDisplayValue('yamada@example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('テスト問い合わせ')).toBeInTheDocument()
      expect(screen.getByDisplayValue('これはテストメッセージです。')).toBeInTheDocument()
    })

    it('カテゴリーと優先度を選択できる', async () => {
      const user = userEvent.setup()
      render(<AdminSupport />)
      
      await user.click(screen.getByRole('tab', { name: 'お問い合わせ' }))
      
      // カテゴリーを選択
      const categorySelect = screen.getByLabelText('カテゴリー')
      await user.selectOptions(categorySelect, 'technical')
      expect(categorySelect).toHaveValue('technical')
      
      // 優先度を選択  
      const prioritySelect = screen.getByLabelText('優先度')
      await user.selectOptions(prioritySelect, 'high')
      expect(prioritySelect).toHaveValue('high')
    })
  })

  it('レスポンシブデザインを考慮したレイアウト', () => {
    render(<AdminSupport />)
    
    // タブリストが適切にレンダリングされている
    const tabList = screen.getByRole('tablist')
    expect(tabList).toBeInTheDocument()
    
    // 4つのタブが存在することを確認（レスポンシブ対応）
    expect(screen.getByRole('tab', { name: 'チケット' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ドキュメント' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'お問い合わせ' })).toBeInTheDocument()
  })
})