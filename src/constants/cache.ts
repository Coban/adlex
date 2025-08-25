/**
 * AdLex キャッシュ設定定数
 * アプリケーション全体で一貫したキャッシュ設定を提供
 */

export const CACHE_CONFIG = {
  // TTL設定（ミリ秒）
  TTL: {
    SHORT: 5 * 60 * 1000,      // 5分 - 頻繁に変更される情報
    MEDIUM: 30 * 60 * 1000,    // 30分 - 中程度の変更頻度
    LONG: 24 * 60 * 60 * 1000, // 24時間 - 安定した情報
    VERY_LONG: 7 * 24 * 60 * 60 * 1000 // 1週間 - 静的情報
  },
  
  // キャッシュキー
  KEYS: {
    USER_SESSION: 'user_session',
    USER_PROFILE: 'user_profile',
    ORGANIZATION: 'organization',
    ORGANIZATION_USERS: 'organization_users',
    DICTIONARY: 'dictionary',
    DICTIONARY_CATEGORIES: 'dictionary_categories',
    CHECK_HISTORY: 'check_history',
    QUEUE_STATUS: 'queue_status',
    SYSTEM_STATUS: 'system_status'
  },
  
  // ローカルストレージキー
  LOCAL_STORAGE: {
    THEME: 'adlex_theme',
    LANGUAGE: 'adlex_language',
    USER_PREFERENCES: 'adlex_user_preferences',
    LAST_CHECK_TEXT: 'adlex_last_check_text',
    UI_STATE: 'adlex_ui_state'
  },
  
  // セッションストレージキー
  SESSION_STORAGE: {
    TEMP_DATA: 'adlex_temp_data',
    FORM_STATE: 'adlex_form_state',
    NAVIGATION_STATE: 'adlex_navigation_state'
  }
} as const

/**
 * TTL値を秒単位で取得
 */
export function getTTLInSeconds(ttlMs: number): number {
  return Math.round(ttlMs / 1000)
}

/**
 * TTL値を分単位で取得
 */
export function getTTLInMinutes(ttlMs: number): number {
  return Math.round(ttlMs / (60 * 1000))
}