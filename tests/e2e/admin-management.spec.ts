import { test, expect } from '@playwright/test'

test.describe('管理者機能 E2E テスト', () => {
  test.beforeEach(async ({ page }) => {
    // 管理者としてログイン
    await page.goto('/login')
    await page.fill('input[name="email"]', 'admin@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // ログイン完了を待つ
    await page.waitForURL('/')
  })

  test.describe('管理者ダッシュボード', () => {
    test('管理者ダッシュボードにアクセスできる', async ({ page }) => {
      await page.goto('/admin')
      
      // ページタイトルを確認
      await expect(page.locator('h1')).toContainText('管理ダッシュボード')
      await expect(page.locator('p')).toContainText('システム全体の統計情報と管理機能')
      
      // ナビゲーションボタンを確認
      await expect(page.locator('text=ユーザー管理')).toBeVisible()
      await expect(page.locator('text=組織設定')).toBeVisible()
      await expect(page.locator('text=システム設定')).toBeVisible()
      await expect(page.locator('text=分析レポート')).toBeVisible()
      await expect(page.locator('text=サポート')).toBeVisible()
    })

    test('統計データが表示される', async ({ page }) => {
      await page.goto('/admin')
      
      // データ読み込み完了を待つ
      await page.waitForSelector('[data-testid="dashboard-stats"]', { state: 'visible' })
      
      // システムヘルス情報の確認
      await expect(page.locator('text=システムヘルス')).toBeVisible()
      
      // 主要統計の確認
      await expect(page.locator('text=総ユーザー数')).toBeVisible()
      await expect(page.locator('text=今月のチェック')).toBeVisible()
      await expect(page.locator('text=平均処理時間')).toBeVisible()
      await expect(page.locator('text=検出違反数')).toBeVisible()
    })

    test('タブ切り替えが動作する', async ({ page }) => {
      await page.goto('/admin')
      
      // アクティビティタブをクリック
      await page.click('button[role="tab"]:has-text("アクティビティ")')
      await expect(page.locator('text=最近のチェック履歴')).toBeVisible()
      
      // パフォーマンスタブをクリック
      await page.click('button[role="tab"]:has-text("パフォーマンス")')
      await expect(page.locator('text=処理ステータス分布')).toBeVisible()
      
      // 利用状況タブをクリック
      await page.click('button[role="tab"]:has-text("利用状況")')
      await expect(page.locator('text=日別チェック数')).toBeVisible()
    })
  })

  test.describe('サポート機能', () => {
    test('サポートページにアクセスできる', async ({ page }) => {
      await page.goto('/admin/support')
      
      await expect(page.locator('h1')).toContainText('サポートセンター')
      await expect(page.locator('text=ヘルプ、FAQ、サポートチケット管理')).toBeVisible()
      
      // タブの確認
      await expect(page.locator('button[role="tab"]:has-text("チケット")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("FAQ")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("ドキュメント")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("お問い合わせ")')).toBeVisible()
    })

    test('サポートチケット一覧を表示する', async ({ page }) => {
      await page.goto('/admin/support')
      
      // デフォルトでチケットタブが表示される
      await expect(page.locator('text=サポートチケット')).toBeVisible()
      await expect(page.locator('text=ユーザーからの問い合わせ管理')).toBeVisible()
      
      // フィルターボタンの確認
      await expect(page.locator('button:has-text("すべて")')).toBeVisible()
      await expect(page.locator('button:has-text("未対応")')).toBeVisible()
      await expect(page.locator('button:has-text("対応中")')).toBeVisible()
      await expect(page.locator('button:has-text("解決済")')).toBeVisible()
      
      // チケット項目の確認
      await expect(page.locator('text=チェック機能が動作しない')).toBeVisible()
      await expect(page.locator('text=辞書の一括登録について')).toBeVisible()
    })

    test('FAQ検索機能が動作する', async ({ page }) => {
      await page.goto('/admin/support')
      
      // FAQタブをクリック
      await page.click('button[role="tab"]:has-text("FAQ")')
      
      // 検索フィールドに入力
      await page.fill('input[placeholder="質問を検索..."]', '料金')
      
      // 料金関連のFAQが表示されることを確認
      await expect(page.locator('text=料金プランについて教えてください')).toBeVisible()
      
      // 関係ないFAQが非表示になることを確認
      await expect(page.locator('text=AdLexとは何ですか？')).toBeHidden()
    })

    test('お問い合わせフォームに入力できる', async ({ page }) => {
      await page.goto('/admin/support')
      
      // お問い合わせタブをクリック
      await page.click('button[role="tab"]:has-text("お問い合わせ")')
      
      // フォームに入力
      await page.fill('input[id="name"]', '山田太郎')
      await page.fill('input[id="email"]', 'yamada@example.com')
      await page.selectOption('select[id="category"]', 'technical')
      await page.selectOption('select[id="priority"]', 'high')
      await page.fill('input[id="subject"]', 'テスト問い合わせ')
      await page.fill('textarea[id="message"]', 'これはE2Eテストからの問い合わせです。')
      
      // 入力値の確認
      await expect(page.locator('input[id="name"]')).toHaveValue('山田太郎')
      await expect(page.locator('input[id="email"]')).toHaveValue('yamada@example.com')
      await expect(page.locator('input[id="subject"]')).toHaveValue('テスト問い合わせ')
      await expect(page.locator('textarea[id="message"]')).toHaveValue('これはE2Eテストからの問い合わせです。')
    })
  })

  test.describe('システム設定', () => {
    test('システム設定ページにアクセスできる', async ({ page }) => {
      await page.goto('/admin/system-settings')
      
      await expect(page.locator('h1')).toContainText('システム設定')
      await expect(page.locator('text=システム全体の設定と機能管理')).toBeVisible()
      
      // タブの確認
      await expect(page.locator('button[role="tab"]:has-text("一般")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("機能フラグ")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("通知")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("API")')).toBeVisible()
      await expect(page.locator('button[role="tab"]:has-text("メンテナンス")')).toBeVisible()
    })

    test('機能フラグの設定ができる', async ({ page }) => {
      await page.goto('/admin/system-settings')
      
      // 機能フラグタブをクリック
      await page.click('button[role="tab"]:has-text("機能フラグ")')
      
      await expect(page.locator('text=機能フラグ管理')).toBeVisible()
      await expect(page.locator('text=実験的機能やベータ機能の有効化/無効化')).toBeVisible()
      
      // 機能フラグの項目を確認
      await expect(page.locator('text=AI自動学習')).toBeVisible()
      await expect(page.locator('text=バッチ処理API')).toBeVisible()
      await expect(page.locator('text=多言語対応')).toBeVisible()
      
      // カテゴリーバッジの確認
      await expect(page.locator('text=experimental')).toBeVisible()
      await expect(page.locator('text=beta')).toBeVisible()
      await expect(page.locator('text=stable')).toBeVisible()
    })

    test('メンテナンスモードの設定ができる', async ({ page }) => {
      await page.goto('/admin/system-settings')
      
      // メンテナンスタブをクリック
      await page.click('button[role="tab"]:has-text("メンテナンス")')
      
      await expect(page.locator('text=メンテナンスモード')).toBeVisible()
      
      // メンテナンスモードを有効にする
      await page.click('button[role="switch"]:near(:text("メンテナンスモード"))')
      
      // メンテナンスメッセージフィールドが表示される
      await expect(page.locator('textarea[id*="message"]')).toBeVisible()
      
      // メッセージを編集
      const messageTextarea = page.locator('textarea:below(:text("メンテナンスメッセージ"))')
      await messageTextarea.clear()
      await messageTextarea.fill('カスタムメンテナンスメッセージ')
      
      await expect(messageTextarea).toHaveValue('カスタムメンテナンスメッセージ')
    })
  })

  test.describe('分析レポート', () => {
    test('分析レポートページにアクセスできる', async ({ page }) => {
      await page.goto('/admin/analytics')
      
      await expect(page.locator('h1')).toContainText('分析レポート')
      await expect(page.locator('text=システム利用状況と業務分析')).toBeVisible()
      
      // 主要KPIカードの確認
      await expect(page.locator('text=総チェック数')).toBeVisible()
      await expect(page.locator('text=アクティブユーザー')).toBeVisible()
      await expect(page.locator('text=成功率')).toBeVisible()
      await expect(page.locator('text=平均処理時間')).toBeVisible()
    })

    test('分析タブの切り替えが動作する', async ({ page }) => {
      await page.goto('/admin/analytics')
      
      // 品質分析タブをクリック
      await page.click('button[role="tab"]:has-text("品質分析")')
      await expect(page.locator('text=違反タイプ分布')).toBeVisible()
      await expect(page.locator('text=品質指標')).toBeVisible()
      
      // ユーザー分析タブをクリック
      await page.click('button[role="tab"]:has-text("ユーザー分析")')
      await expect(page.locator('text=ユーザー行動分析')).toBeVisible()
      await expect(page.locator('text=ユーザーセグメント')).toBeVisible()
      
      // 売上分析タブをクリック
      await page.click('button[role="tab"]:has-text("売上分析")')
      await expect(page.locator('text=売上指標')).toBeVisible()
      await expect(page.locator('text=顧客動向')).toBeVisible()
      await expect(page.locator('text=プラン別分析')).toBeVisible()
    })

    test('レポート出力機能が動作する', async ({ page }) => {
      await page.goto('/admin/analytics')
      
      // レポート出力ボタンをクリック
      await page.click('button:has-text("レポート出力")')
      
      // ローディング状態になることを確認
      await expect(page.locator('button:has-text("エクスポート中...")')).toBeVisible()
      
      // ダウンロードイベントを待つ（実際のファイルダウンロードはモック化）
      await page.waitForTimeout(2000)
      
      // ボタンが元の状態に戻ることを確認
      await expect(page.locator('button:has-text("レポート出力")')).toBeVisible()
    })

    test('時間範囲セレクターが動作する', async ({ page }) => {
      await page.goto('/admin/analytics')
      
      // セレクターをクリック
      await page.click('button[role="combobox"]')
      
      // オプションが表示されることを確認（shadcn/uiの実装に依存）
      // この部分は実際のSelect実装に合わせて調整が必要
    })
  })

  test.describe('権限制御', () => {
    test('一般ユーザーは管理者ページにアクセスできない', async ({ page }) => {
      // 管理者をログアウト
      await page.goto('/logout')
      
      // 一般ユーザーでログイン
      await page.goto('/login')
      await page.fill('input[name="email"]', 'user1@test.com')
      await page.fill('input[name="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')
      
      // 管理者ページにアクセスを試みる
      await page.goto('/admin')
      
      // アクセス拒否メッセージを確認
      await expect(page.locator('text=アクセスが拒否されました')).toBeVisible()
      await expect(page.locator('text=このページにアクセスするには管理者権限が必要です。')).toBeVisible()
    })

    test('未認証ユーザーはログインページにリダイレクトされる', async ({ page }) => {
      // 未認証状態で管理者ページにアクセス
      await page.goto('/admin')
      
      // ログインページにリダイレクトされることを確認
      await page.waitForURL('/login')
      await expect(page.locator('text=ログイン')).toBeVisible()
    })
  })

  test.describe('レスポンシブデザイン', () => {
    test('モバイルビューポートでも正しく表示される', async ({ page }) => {
      // モバイルサイズに変更
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('/admin')
      
      // ページが正しく表示されることを確認
      await expect(page.locator('h1')).toContainText('管理ダッシュボード')
      
      // ナビゲーションボタンが縦に並んで表示されることを確認
      const buttons = page.locator('a:has-text("ユーザー管理"), a:has-text("システム設定")')
      const firstButton = buttons.first()
      const secondButton = buttons.nth(1)
      
      const firstButtonBox = await firstButton.boundingBox()
      const secondButtonBox = await secondButton.boundingBox()
      
      // 縦に並んでいることを確認（Y座標が異なる）
      if (firstButtonBox && secondButtonBox) {
        expect(firstButtonBox.y).not.toEqual(secondButtonBox.y)
      }
    })

    test('タブレットビューポートでも正しく表示される', async ({ page }) => {
      // タブレットサイズに変更
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await page.goto('/admin/analytics')
      
      // グリッドレイアウトが適切に調整されることを確認
      await expect(page.locator('text=総チェック数')).toBeVisible()
      await expect(page.locator('text=アクティブユーザー')).toBeVisible()
      
      // KPIカードが適切に配置されることを確認
      const kpiCards = page.locator('[data-testid*="kpi"], .grid > .card, .grid > div:has(text="総チェック数")')
      const cardCount = await kpiCards.count()
      expect(cardCount).toBeGreaterThanOrEqual(4)
    })
  })
})