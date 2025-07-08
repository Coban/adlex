import { Suspense } from 'react'

import CheckHistoryList from '@/components/CheckHistoryList'

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">チェック履歴</h1>
        <p className="text-gray-600">
          過去に実行したチェックの履歴を確認できます。
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
        <CheckHistoryList />
      </Suspense>
    </div>
  )
}