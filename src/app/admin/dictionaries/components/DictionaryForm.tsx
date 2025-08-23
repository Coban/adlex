import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dictionary, DictionaryFormData } from '../types'

interface DictionaryFormProps {
  editingDictionary: Dictionary | null
  showAddForm: boolean
  formData: DictionaryFormData
  setFormData: (data: DictionaryFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function DictionaryForm({
  editingDictionary,
  showAddForm,
  formData,
  setFormData,
  onSubmit,
  onCancel,
}: DictionaryFormProps) {
  if (!showAddForm && !editingDictionary) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingDictionary ? '辞書項目編集' : '新規辞書項目作成'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phrase">フレーズ *</Label>
            <Input
              id="phrase"
              value={formData.phrase}
              onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
              required
              placeholder="チェック対象のフレーズを入力"
            />
          </div>
          <div>
            <Label htmlFor="category">カテゴリ *</Label>
            <select
              id="category"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as 'NG' | 'ALLOW' })}
            >
              <option value="NG">NG（使用禁止）</option>
              <option value="ALLOW">許可（使用可能）</option>
            </select>
          </div>
          <div>
            <Label htmlFor="notes">備考</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="備考や使用例など（任意）"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">
              {editingDictionary ? '更新' : '作成'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}