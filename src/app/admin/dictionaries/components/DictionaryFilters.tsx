import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategoryFilter, SortOption } from '../types'

interface DictionaryFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedCategory: CategoryFilter
  setSelectedCategory: (category: CategoryFilter) => void
  sortOption: SortOption
  setSortOption: (option: SortOption) => void
}

export function DictionaryFilters({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  sortOption,
  setSortOption,
}: DictionaryFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Label htmlFor="search">検索</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="フレーズや備考で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="dictionary-search"
              />
              <Button variant="outline" data-testid="search-button">
                検索
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              引用句: &quot;高濃度&quot; / 除外: -臨床 / フィールド指定: phrase:薬機 notes:注意 / OR: 効果|効能
            </p>
          </div>
          <div className="w-full md:w-48">
            <Label htmlFor="category">カテゴリ</Label>
            <select
              id="category"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryFilter)}
              data-testid="category-filter"
            >
              <option value="ALL">すべて</option>
              <option value="NG">NG</option>
              <option value="ALLOW">許可</option>
            </select>
          </div>
          <div className="w-full md:w-64">
            <Label htmlFor="sort">ソート</Label>
            <select
              id="sort"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              data-testid="sort-option"
            >
              <option value="created_desc">作成日: 新しい順</option>
              <option value="created_asc">作成日: 古い順</option>
              <option value="updated_desc">更新日: 新しい順</option>
              <option value="updated_asc">更新日: 古い順</option>
              <option value="phrase_asc">フレーズ: A→Z</option>
              <option value="phrase_desc">フレーズ: Z→A</option>
              <option value="category_asc">カテゴリ: NG→許可</option>
              <option value="category_desc">カテゴリ: 許可→NG</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}