import { BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import CheckHistoryList from '@/components/CheckHistoryList'
import { Button } from '@/components/ui/button'

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">チェック履歴</h1>
            <p className="text-gray-600">
              過去に実行したチェックの履歴を確認できます。
            </p>
          </div>
          <Link href="/history/stats">
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              統計を見る
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
        <CheckHistoryList />
      </Suspense>
    </div>
  )
}