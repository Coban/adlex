/**
 * AdLex統一定数エクスポート
 * アプリケーション全体の定数を一元管理
 */

export * from './timeouts'
export * from './cache'
export * from './retry'

// アプリケーション基本定数
export const APP_CONFIG = {
  // アプリケーション情報
  NAME: 'AdLex',
  VERSION: '1.0.0',
  DESCRIPTION: '薬機法コンプライアンスチェッカー',
  
  // ファイル制限
  FILE_SIZE_LIMITS: {
    IMAGE: 10 * 1024 * 1024,      // 10MB - 画像ファイル
    DOCUMENT: 5 * 1024 * 1024,    // 5MB - ドキュメントファイル
    GENERAL: 2 * 1024 * 1024      // 2MB - 一般ファイル
  },
  
  // テキスト制限
  TEXT_LIMITS: {
    MAX_LENGTH: 10000,            // 10,000文字 - チェック対象テキスト
    MIN_LENGTH: 1,                // 1文字 - 最小入力長
    PREVIEW_LENGTH: 100,          // 100文字 - プレビュー表示長
    SUMMARY_LENGTH: 50            // 50文字 - サマリー表示長
  },
  
  // ページネーション
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,        // デフォルト表示件数
    MAX_PAGE_SIZE: 100,           // 最大表示件数
    SMALL_PAGE_SIZE: 10,          // 小さいページサイズ
    LARGE_PAGE_SIZE: 50           // 大きいページサイズ
  },
  
  // UI設定
  UI: {
    TOAST_DURATION: 3000,         // 3秒 - トースト表示時間
    ANIMATION_DURATION: 200,      // 200ms - アニメーション時間
    DEBOUNCE_DELAY: 300,          // 300ms - デバウンス遅延
    THROTTLE_DELAY: 100           // 100ms - スロットル遅延
  },
  
  // 色設定
  COLORS: {
    BRAND: {
      PRIMARY: 'hsl(222.2 84% 4.9%)',
      SECONDARY: 'hsl(210 40% 98%)',
      ACCENT: 'hsl(210 40% 98%)'
    },
    STATUS: {
      SUCCESS: 'hsl(142.1 76.2% 36.3%)',
      WARNING: 'hsl(47.9 95.8% 53.1%)',
      ERROR: 'hsl(0 84.2% 60.2%)',
      INFO: 'hsl(221.2 83.2% 53.3%)'
    }
  }
} as const

// 環境設定
export const ENV_CONFIG = {
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',
  IS_SKIP_AUTH: process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true'
} as const