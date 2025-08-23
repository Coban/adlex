import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DictionaryListProps } from '../types'

export function DictionaryList({ 
  dictionaries, 
  selectedIds, 
  onToggleSelect, 
  onEdit, 
  onDelete 
}: DictionaryListProps) {
  if (dictionaries.length === 0) {
    return (
      <div className="space-y-2" data-testid="dictionary-list">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            辞書項目がありません
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="dictionary-list">
      {dictionaries.map((dictionary) => (
        <Card key={dictionary.id} data-testid="dictionary-item">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start gap-3">
              <div className="pt-1">
                <input
                  type="checkbox"
                  aria-label="select"
                  checked={selectedIds.has(dictionary.id)}
                  onChange={() => onToggleSelect(dictionary.id)}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium" data-testid="phrase-text">{dictionary.phrase}</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      dictionary.category === 'NG'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                    data-testid="phrase-category"
                  >
                    {dictionary.category}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      dictionary.vector
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {dictionary.vector ? 'Embedding済み' : 'Embedding未済'}
                  </span>
                </div>
                {dictionary.notes && (
                  <p className="text-sm text-muted-foreground mb-2">{dictionary.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  作成日: {new Date(dictionary.created_at!).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="flex gap-2" data-testid="phrase-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(dictionary)}
                  data-testid="edit-button"
                >
                  編集
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(dictionary.id)}
                  data-testid="delete-button"
                >
                  削除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}