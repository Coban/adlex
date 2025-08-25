import { Button } from '@/components/ui/button'

interface ActionButtonsProps {
  isAdmin: boolean
  embeddingRefreshLoading: boolean
  importing: boolean
  showAddForm: boolean
  onDetectDuplicates: () => void
  onBulkCategory: () => void
  onBulkNotes: () => void
  onExportCSV: () => void
  onImportCSV: (file: File) => void
  onRegenerateEmbeddings: () => void
  onShowAddForm: () => void
}

export function ActionButtons({
  isAdmin,
  embeddingRefreshLoading,
  importing,
  showAddForm,
  onDetectDuplicates,
  onBulkCategory,
  onBulkNotes,
  onExportCSV,
  onImportCSV,
  onRegenerateEmbeddings,
  onShowAddForm,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-2">
      {isAdmin && (
        <>
          <Button 
            onClick={onDetectDuplicates}
            variant="outline"
            data-testid="detect-duplicates"
          >
            重複検出
          </Button>
          <Button
            onClick={onBulkCategory}
            variant="outline"
            data-testid="bulk-category"
          >
            一括カテゴリ
          </Button>
          <Button
            onClick={onBulkNotes}
            variant="outline"
            data-testid="bulk-notes"
          >
            一括メモ
          </Button>
          <Button 
            onClick={onExportCSV}
            variant="outline"
            data-testid="export-csv"
          >
            エクスポートCSV
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={async (ev) => {
                const file = ev.target.files?.[0]
                if (!file) return
                await onImportCSV(file)
                // リセット
                ;(ev.target as HTMLInputElement).value = ''
              }}
            />
            <Button asChild disabled={importing} data-testid="import-csv">
              <span>{importing ? 'インポート中...' : 'インポートCSV'}</span>
            </Button>
          </label>
        </>
      )}
      {isAdmin && (
        <Button 
          onClick={onRegenerateEmbeddings} 
          disabled={embeddingRefreshLoading}
          variant="outline"
          data-testid="regenerate-embeddings"
        >
          {embeddingRefreshLoading ? 'Embedding再生成中...' : 'Embedding再生成'}
        </Button>
      )}
      <Button 
        onClick={onShowAddForm} 
        disabled={showAddForm} 
        data-testid="add-phrase-button"
      >
        新規作成
      </Button>
    </div>
  )
}