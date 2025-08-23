import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmbeddingStats, DictionaryStats as DictionaryStatsType } from '../types'

interface EmbeddingStatsCardProps {
  stats: EmbeddingStats
}

export function EmbeddingStatsCard({ stats }: EmbeddingStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Embedding統計情報</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <div className="text-sm text-muted-foreground">総項目数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.itemsWithEmbedding}</div>
            <div className="text-sm text-muted-foreground">Embedding済み</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.itemsWithoutEmbedding}</div>
            <div className="text-sm text-muted-foreground">Embedding未済</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.embeddingCoverageRate}%</div>
            <div className="text-sm text-muted-foreground">カバー率</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DictionaryStatsCardProps {
  stats: DictionaryStatsType
}

export function DictionaryStatsCard({ stats }: DictionaryStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>辞書統計（最近30日 使用頻度）</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totals.total}</div>
            <div className="text-sm text-muted-foreground">総項目数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.totals.ng}</div>
            <div className="text-sm text-muted-foreground">NG</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.totals.allow}</div>
            <div className="text-sm text-muted-foreground">許可</div>
          </div>
        </div>
        {stats.topUsed.length > 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              上位フレーズ（{new Date(stats.since).toLocaleDateString('ja-JP')} 以降）
            </p>
            <ul className="list-disc pl-6 space-y-1">
              {stats.topUsed.slice(0, 5).map((t) => (
                <li key={t.dictionary_id} className="text-sm">
                  {t.phrase} — {t.count}回
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">最近30日の使用データはありません</p>
        )}
      </CardContent>
    </Card>
  )
}