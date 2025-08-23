export interface Violation {
  id: number
  startPos: number
  endPos: number
  reason: string
  dictionaryPhrase?: string
  dictionaryCategory?: 'NG' | 'ALLOW'
}

export interface CheckDetail {
  id: number
  originalText: string
  modifiedText: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  inputType: 'text' | 'image'
  imageUrl?: string | null
  extractedText?: string | null
  ocrStatus?: string | null
  ocrMetadata?: Record<string, unknown>
  createdAt: string
  completedAt: string | null
  userEmail?: string
  violations: Violation[]
}

export interface CheckHistoryDetailProps {
  checkId: number
}

export const statusLabels = {
  pending: { label: '待機中', className: 'bg-gray-100 text-gray-800' },
  processing: { label: '処理中', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', className: 'bg-green-100 text-green-800' },
  failed: { label: 'エラー', className: 'bg-red-100 text-red-800' }
} as const