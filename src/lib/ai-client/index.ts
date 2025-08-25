/**
 * AI Client メインエクスポート
 * 分割されたAI Client モジュールの統合ポイント
 */

// 型定義
export * from './types'

// 設定管理
export * from './config'

// ユーティリティ
export * from './utils'

// プロバイダー実装
export * from './openai-client'
export * from './openrouter-client'
export * from './lmstudio-client'
export * from './mock-client'

// ファクトリー
export * from './factory'

// 後方互換性のため、既存のエクスポートを維持
export { aiClient as default } from './factory'