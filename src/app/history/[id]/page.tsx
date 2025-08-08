import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import CheckHistoryDetail from '@/components/CheckHistoryDetail'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function HistoryDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const checkId = parseInt(resolvedParams.id)
  
  if (isNaN(checkId)) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
        <CheckHistoryDetail checkId={checkId} />
      </Suspense>
    </div>
  )
}