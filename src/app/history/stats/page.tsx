import { Suspense } from 'react'

import CheckHistoryStats from '@/components/CheckHistoryStats'

export default function HistoryStatsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">チェック履歴統計</h1>
        <p className="text-gray-600">
          チェック履歴の統計情報とパフォーマンス分析を確認できます。
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center">統計を読み込み中...</div>}>
        <CheckHistoryStats />
      </Suspense>
    </div>
  )
}