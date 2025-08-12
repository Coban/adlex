// コンポーネント関連の型定義

// 画像アップロード状態の型（アップロード処理のステップを管理）
export type UploadState = 'idle' | 'ready' | 'validating' | 'uploading' | 'uploaded' | 'starting_check' | 'processing' | 'completed' | 'failed'

// チェックアイテム（フロントエンドでチェック処理を管理する型）
export interface CheckItem {
  id: string
  originalText: string
  result: CheckResult | null
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  statusMessage: string
  timestamp: number
  queuePosition?: number
}

// キューの状態情報
export interface QueueStatus {
  queueLength: number // キューの長さ
  processingCount: number // 処理中アイテム数
  maxConcurrent: number // 最大同時処理数
  databaseProcessingCount: number // DB処理中数
  availableSlots: number // 利用可能スロット数
  processingStats: { // 処理統計
    text: number
    image: number
  }
  canStartNewCheck: boolean // 新規チェック開始可能フラグ
}

// 組織の使用状況
export interface OrganizationStatus {
  monthlyLimit: number // 月次制限
  currentMonthChecks: number // 今月のチェック数
  remainingChecks: number // 残りチェック数
  canPerformCheck: boolean // チェック実行可能フラグ
}

// システム状態
export interface SystemStatus {
  timestamp: string // タイムスタンプ
  serverLoad: { // サーバー負荷状態
    queue: 'idle' | 'busy'
    processing: 'available' | 'full'
  }
}

// 違反情報（フロントエンド表示用）
export interface Violation {
  id: number
  startPos: number
  endPos: number
  reason: string
  dictionary_id?: number
}

// ストリーミングデータ（Server-Sent Events用）
export interface CheckStreamData {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error?: string
  id?: number
  original_text?: string
  modified_text?: string
  violations?: Array<{
    id: number
    start_pos: number
    end_pos: number
    reason: string
    dictionary_id: number | null
  }>
}

// チェック結果（APIレスポンス用）
export interface CheckResult {
  id: number
  original_text: string
  modified_text: string
  status: string
  violations: Violation[]
}

// チェック履歴（一覧表示用）
export interface CheckHistory {
  id: string
  input_text: string
  input_type: 'text' | 'image'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  violations_count: number
  created_at: string
  completed_at: string | null
}

// ページネーション情報
export interface PaginationInfo {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// 履歴APIレスポンス
export interface HistoryResponse {
  data: CheckHistory[]
  pagination: PaginationInfo
}

// チェック詳細データ
export interface CheckDetail {
  id: string
  input_text: string
  input_type: 'text' | 'image'
  extracted_text?: string | null
  image_url?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  violations: Violation[]
  created_at: string
  completed_at: string | null
  error_message?: string | null
}

// チェック履歴詳細コンポーネントのプロパティ
export interface CheckHistoryDetailProps {
  checkId: string
}

// ナビゲーションアイテム
export interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  current?: boolean
  adminOnly?: boolean
}

// ページコンポーネントのプロパティ（Next.js App Router用）
export interface PageProps {
  params: Promise<{ id: string }>
}

// ダッシュボード統計データ
export interface DashboardStats {
  totalUsers: number
  totalChecks: number
  totalViolations: number
  checksToday: number
}