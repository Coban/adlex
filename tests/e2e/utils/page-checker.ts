import { Page } from '@playwright/test'

/**
 * ページが存在するかチェックし、404ページの場合はtrueを返す
 */
export async function isPageNotFound(page: Page): Promise<boolean> {
  try {
    // 404ページの典型的な要素をチェック
    const notFoundSelectors = [
      'text=404',
      'text=ページが見つかりません',
      'text=Page Not Found',
      'text=お探しのページは存在しません'
    ]
    
    for (const selector of notFoundSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        return true
      }
    }
    
    return false
  } catch (error) {
    // 実行コンテキストが破棄された場合（ナビゲーションなど）、
    // ページが見つからないとは言えないのでfalseを返す
    return false
  }
}

/**
 * ページの読み込み完了を待機
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
  } catch (error) {
    // ナビゲーションによりコンテキストが破棄された場合も正常として扱う
    console.warn('Page load wait interrupted, likely due to navigation')
  }
}