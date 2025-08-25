/**
 * AI Client - リファクタリング済み統合ポイント
 * 
 * このファイルは後方互換性を維持しつつ、
 * 分割された ai-client モジュール群へのアクセスポイントとして機能します。
 * 
 * モジュール構造:
 * - ai-client/types.ts - 共通型定義
 * - ai-client/config.ts - 設定管理
 * - ai-client/utils.ts - ユーティリティ関数
 * - ai-client/openai-client.ts - OpenAI実装
 * - ai-client/openrouter-client.ts - OpenRouter実装  
 * - ai-client/lmstudio-client.ts - LM Studio実装
 * - ai-client/mock-client.ts - モック実装
 * - ai-client/factory.ts - ファクトリー
 * - ai-client/main.ts - メイン統合関数
 */

// 全てのエクスポートを新しいモジュールから再エクスポート
export * from './ai-client/index'

// メイン関数をデフォルトエクスポートとして提供
export { 
  createChatCompletion, 
  createChatCompletionForCheck, 
  createEmbedding,
  extractTextFromImageWithLLM,
  extractTextFromImage,
  getEmbeddingDimension,
  estimateOcrConfidence
} from './ai-client/main'

// OCR関連の型と機能もエクスポート
export type { OcrOptions, OcrResult } from './ai-client/main'

// デフォルトクライアントをエクスポート
export { aiClient as default } from './ai-client/factory'