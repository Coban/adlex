/**
 * AdLex タイムアウト設定定数
 * アプリケーション全体で一貫したタイムアウト設定を提供
 */

export const TIMEOUTS = {
  // API関連タイムアウト（ミリ秒）
  API_REQUEST: 30000,           // 30秒 - 通常のAPIリクエスト
  CHECK_PROCESSING: 120000,     // 2分 - テキストチェック処理
  IMAGE_CHECK_PROCESSING: 180000, // 3分 - 画像チェック処理（OCR含む）
  STREAM_CONNECTION: 5000,      // 5秒 - SSEストリーム接続タイムアウト
  
  // 画像処理関連タイムアウト
  IMAGE_PROCESSING: 60000,      // 1分 - 画像アップロード・変換
  OCR_PROCESSING: 30000,        // 30秒 - OCRテキスト抽出
  IMAGE_VALIDATION: 5000,       // 5秒 - 画像ファイル検証
  
  // UI関連タイムアウト
  TOAST_DISPLAY: 3000,          // 3秒 - トースト通知表示時間
  DEBOUNCE_INPUT: 300,          // 300ms - 入力デバウンス
  ANIMATION: 200,               // 200ms - UIアニメーション
  
  // セッション関連
  SESSION_CHECK: 200,           // 200ms - セッション状態確認
  AUTH_TIMEOUT: 10000,          // 10秒 - 認証処理タイムアウト
  
  // ポーリング関連
  POLLING_INTERVAL: {
    TEXT_CHECK: 1000,           // 1秒 - テキストチェックポーリング間隔
    IMAGE_CHECK: 2000,          // 2秒 - 画像チェックポーリング間隔（負荷軽減）
    QUEUE_STATUS: 5000,         // 5秒 - キューステータス更新間隔
  },
  
  // ポーリング最大回数
  MAX_POLLS: {
    TEXT_CHECK: 90,             // テキスト処理: 90回 × 1秒 = 1.5分
    IMAGE_CHECK: 90,            // 画像処理: 90回 × 2秒 = 3分
    QUEUE_STATUS: 12,           // キューステータス: 12回 × 5秒 = 1分
  }
} as const

/**
 * 処理タイプに応じたタイムアウト設定を取得
 */
export function getProcessingTimeouts(isImageCheck = false) {
  if (isImageCheck) {
    return {
      maxPolls: TIMEOUTS.MAX_POLLS.IMAGE_CHECK,
      pollIntervalMs: TIMEOUTS.POLLING_INTERVAL.IMAGE_CHECK,
      totalTimeoutMs: TIMEOUTS.IMAGE_CHECK_PROCESSING,
      description: '画像処理'
    }
  } else {
    return {
      maxPolls: TIMEOUTS.MAX_POLLS.TEXT_CHECK,
      pollIntervalMs: TIMEOUTS.POLLING_INTERVAL.TEXT_CHECK,
      totalTimeoutMs: TIMEOUTS.CHECK_PROCESSING,
      description: 'テキスト処理'
    }
  }
}

/**
 * タイムアウト時間を分単位で取得
 */
export function getTimeoutInMinutes(timeoutMs: number): number {
  return Math.round(timeoutMs / 60000)
}