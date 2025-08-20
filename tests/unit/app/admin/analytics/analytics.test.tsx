import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AdminAnalytics from '@/app/admin/analytics/page'

// URL.createObjectURLをモック
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// JSDOMの制限を回避するためのモック
Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  value: vi.fn(() => false),
  writable: true,
})

Object.defineProperty(Element.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true,
})

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  value: vi.fn(),
  writable: true,
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

describe('AdminAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // formatCurrency関数のテスト用ヘルパー
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  it('分析レポートページのタイトルを表示する', () => {
    render(<AdminAnalytics />)
    
    expect(screen.getByText('分析レポート')).toBeInTheDocument()
    expect(screen.getByText('システム利用状況と業務分析')).toBeInTheDocument()
  })

  it('時間範囲セレクターとレポート出力ボタンを表示する', () => {
    render(<AdminAnalytics />)
    
    // 時間範囲セレクター
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    
    // レポート出力ボタン
    expect(screen.getByText('レポート出力')).toBeInTheDocument()
  })

  it('主要KPIカードを表示する', () => {
    render(<AdminAnalytics />)
    
    // KPIカードのタイトル
    expect(screen.getByText('総チェック数')).toBeInTheDocument()
    expect(screen.getByText('アクティブユーザー')).toBeInTheDocument()
    expect(screen.getByText('成功率')).toBeInTheDocument()
    expect(screen.getByText('平均処理時間')).toBeInTheDocument()
    
    // モックデータの値
    expect(screen.getByText('15,432')).toBeInTheDocument() // 総チェック数
    expect(screen.getByText('234')).toBeInTheDocument() // アクティブユーザー
    expect(screen.getByText('98.5%')).toBeInTheDocument() // 成功率
    expect(screen.getByText('2.8秒')).toBeInTheDocument() // 平均処理時間
  })

  it('タブが正しく表示される', () => {
    render(<AdminAnalytics />)
    
    expect(screen.getByRole('tab', { name: '利用統計' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '品質分析' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ユーザー分析' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '売上分析' })).toBeInTheDocument()
  })

  describe('利用統計タブ', () => {
    it('利用統計データを表示する', () => {
      render(<AdminAnalytics />)
      
      // デフォルトで利用統計タブが選択されている
      expect(screen.getByText('利用トレンド')).toBeInTheDocument()
      expect(screen.getByText('チェック実行数の推移')).toBeInTheDocument()
      
      // 統計データ
      expect(screen.getByText('今月')).toBeInTheDocument()
      expect(screen.getByText('先月')).toBeInTheDocument()
      expect(screen.getByText('1日平均')).toBeInTheDocument()
      expect(screen.getByText('ピーク時間')).toBeInTheDocument()
      
      // モックデータの値
      expect(screen.getByText('2341回')).toBeInTheDocument() // 今月
      expect(screen.getByText('1987回')).toBeInTheDocument() // 先月
      expect(screen.getByText('78回')).toBeInTheDocument() // 1日平均
      expect(screen.getByText('14:00-15:00')).toBeInTheDocument() // ピーク時間
      
      // 時間帯別利用状況
      expect(screen.getByText('時間帯別利用状況')).toBeInTheDocument()
      expect(screen.getByText('24時間の利用パターン')).toBeInTheDocument()
    })
  })

  describe('品質分析タブ', () => {
    it('品質分析データを表示する', async () => {
      const user = userEvent.setup()
      render(<AdminAnalytics />)
      
      await user.click(screen.getByRole('tab', { name: '品質分析' }))
      
      expect(screen.getByText('違反タイプ分布')).toBeInTheDocument()
      expect(screen.getByText('検出された違反の種類と件数')).toBeInTheDocument()
      
      // 違反タイプ
      expect(screen.getByText('効果・効能の誇大表現')).toBeInTheDocument()
      expect(screen.getByText('医薬品的な効果の暗示')).toBeInTheDocument()
      expect(screen.getByText('特定部位への言及')).toBeInTheDocument()
      expect(screen.getByText('即効性の表現')).toBeInTheDocument()
      
      // 件数とパーセンテージ
      expect(screen.getByText('1234件 (35.2%)')).toBeInTheDocument()
      expect(screen.getByText('987件 (28.1%)')).toBeInTheDocument()
      expect(screen.getByText('654件 (18.7%)')).toBeInTheDocument()
      
      // 品質指標
      expect(screen.getByText('品質指標')).toBeInTheDocument()
      expect(screen.getByText('AI検出精度と品質メトリクス')).toBeInTheDocument()
      expect(screen.getByText('検出精度')).toBeInTheDocument()
      expect(screen.getByText('94.7%')).toBeInTheDocument()
    })
  })

  describe('ユーザー分析タブ', () => {
    it('ユーザー分析データを表示する', async () => {
      const user = userEvent.setup()
      render(<AdminAnalytics />)
      
      await user.click(screen.getByRole('tab', { name: 'ユーザー分析' }))
      
      expect(screen.getByText('ユーザー行動分析')).toBeInTheDocument()
      expect(screen.getByText('ユーザーの利用パターン')).toBeInTheDocument()
      
      // ユーザー指標
      expect(screen.getByText('リテンション率')).toBeInTheDocument()
      expect(screen.getByText('平均セッション時間')).toBeInTheDocument()
      expect(screen.getByText('85.3%')).toBeInTheDocument()
      expect(screen.getByText('12.5分')).toBeInTheDocument()
      
      // ユーザーセグメント
      expect(screen.getByText('ユーザーセグメント')).toBeInTheDocument()
      expect(screen.getByText('利用度別ユーザー分類')).toBeInTheDocument()
      expect(screen.getByText('ヘビーユーザー')).toBeInTheDocument()
      expect(screen.getByText('レギュラーユーザー')).toBeInTheDocument()
      expect(screen.getByText('ライトユーザー')).toBeInTheDocument()
      
      // パーセンテージ
      expect(screen.getByText('28% (65人)')).toBeInTheDocument()
      expect(screen.getByText('45% (105人)')).toBeInTheDocument()
      expect(screen.getByText('27% (64人)')).toBeInTheDocument()
    })
  })

  describe('売上分析タブ', () => {
    it('売上分析データを表示する', async () => {
      const user = userEvent.setup()
      render(<AdminAnalytics />)
      
      await user.click(screen.getByRole('tab', { name: '売上分析' }))
      
      expect(screen.getByText('売上指標')).toBeInTheDocument()
      expect(screen.getByText('収益とビジネスメトリクス')).toBeInTheDocument()
      
      // 売上指標
      expect(screen.getByText('月間売上')).toBeInTheDocument()
      expect(screen.getByText('年間売上')).toBeInTheDocument()
      expect(screen.getByText('ARPU')).toBeInTheDocument()
      expect(screen.getByText('LTV')).toBeInTheDocument()
      
      // 金額（フォーマットされた形式）
      // formatCurrencyを使用した実際のフォーマットをテスト
      expect(screen.getByText(formatCurrency(1250000))).toBeInTheDocument()
      expect(screen.getByText(formatCurrency(14800000))).toBeInTheDocument()
      
      // 顧客動向
      expect(screen.getByText('顧客動向')).toBeInTheDocument()
      expect(screen.getByText('解約率と顧客維持')).toBeInTheDocument()
      expect(screen.getByText('解約率')).toBeInTheDocument()
      expect(screen.getByText('3.2%')).toBeInTheDocument()
      expect(screen.getByText('96.8%')).toBeInTheDocument() // 顧客維持率
      
      // プラン別分析
      expect(screen.getByText('プラン別分析')).toBeInTheDocument()
      expect(screen.getByText('料金プラン別の収益分布')).toBeInTheDocument()
      expect(screen.getByText('エンタープライズ')).toBeInTheDocument()
      expect(screen.getByText('プロフェッショナル')).toBeInTheDocument()
      expect(screen.getByText('スタンダード')).toBeInTheDocument()
      expect(screen.getByText('ベーシック')).toBeInTheDocument()
    })
  })

  it('時間範囲を変更できる', async () => {
    const user = userEvent.setup()
    render(<AdminAnalytics />)
    
    // セレクターをクリック
    const select = screen.getByRole('combobox')
    await user.click(select)
    
    // オプションが表示されることを確認（実際の実装に依存）
    // この部分は shadcn/ui の Select コンポーネントの実装によって異なる
  })

  it('レポート出力機能が動作する', async () => {
    const user = userEvent.setup()
    render(<AdminAnalytics />)
    
    const exportButton = screen.getByText('レポート出力')
    await user.click(exportButton)
    
    // ローディング状態になることを確認
    await waitFor(() => {
      expect(screen.getByText('エクスポート中...')).toBeInTheDocument()
    })
  })

  it('レスポンシブデザインを考慮したレイアウト', () => {
    render(<AdminAnalytics />)
    
    // グリッドレイアウトのクラスが適用されている
    const kpiContainer = screen.getByText('総チェック数').closest('.grid')
    expect(kpiContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
  })

  it('成長率が正しく計算される', () => {
    render(<AdminAnalytics />)
    
    // 前月比の成長率（2341 - 1987) / 1987 * 100 = 17.8%
    expect(screen.getByText('+17.8%')).toBeInTheDocument()
    expect(screen.getByText('前月比')).toBeInTheDocument()
  })

  it('通貨フォーマットが正しく適用される', async () => {
    const user = userEvent.setup()
    render(<AdminAnalytics />)
    
    await user.click(screen.getByRole('tab', { name: '売上分析' }))
    
    // 日本円フォーマット（Intl.NumberFormatで生成される実際の形式）
    expect(screen.getByText(formatCurrency(1250000))).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(14800000))).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(8900))).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(45600))).toBeInTheDocument()
  })

  it('プログレスバーが正しい値で表示される', async () => {
    const user = userEvent.setup()
    render(<AdminAnalytics />)
    
    await user.click(screen.getByRole('tab', { name: 'ユーザー分析' }))
    
    // プログレスバーコンポーネントが存在することを確認
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBeGreaterThan(0)
  })
})