import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LoadingState() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">チェック詳細を読み込んでいます...</p>
      </div>
    </div>
  )
}

interface ErrorStateProps {
  error: string
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/history">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            履歴一覧に戻る
          </Button>
        </Link>
      </div>
    </div>
  )
}

export function NotFoundState() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-gray-600 mb-4">チェック詳細が見つかりません</p>
        <Link href="/history">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            履歴一覧に戻る
          </Button>
        </Link>
      </div>
    </div>
  )
}