import { Button } from '@/components/ui/button'

import { DuplicateGroup } from '../types'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" data-testid="confirm-delete">
        <h3 className="text-lg font-semibold mb-4">辞書項目を削除</h3>
        <p className="text-gray-600 mb-6">
          この辞書項目を削除しますか？この操作は取り消せません。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirm}
            data-testid="confirm-button"
          >
            削除
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RegenerateEmbeddingsDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function RegenerateEmbeddingsDialog({
  isOpen,
  onConfirm,
  onCancel,
}: RegenerateEmbeddingsDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" data-testid="confirm-regenerate">
        <h3 className="text-lg font-semibold mb-4">埋め込みを再生成</h3>
        <p className="text-gray-600 mb-6">
          すべての辞書項目のEmbeddingを再生成しますか？この処理には時間がかかる場合があります。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button 
            onClick={onConfirm}
            data-testid="confirm-button"
          >
            再生成
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DuplicatesDialogProps {
  isOpen: boolean
  duplicates: DuplicateGroup[] | null
  onClose: () => void
}

export function DuplicatesDialog({
  isOpen,
  duplicates,
  onClose,
}: DuplicatesDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">重複検出</h3>
        <div className="max-h-80 overflow-auto border rounded">
          {duplicates === null ? (
            <div className="p-4 text-sm text-muted-foreground">読み込み中...</div>
          ) : duplicates.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">重複は見つかりませんでした</div>
          ) : (
            <ul className="divide-y">
              {duplicates.map((d) => (
                <li key={d.phrase} className="p-3">
                  <div className="font-medium">{d.phrase}</div>
                  <div className="text-xs text-muted-foreground">{d.items.length} 件</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>閉じる</Button>
        </div>
      </div>
    </div>
  )
}