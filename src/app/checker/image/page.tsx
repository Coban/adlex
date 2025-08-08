'use client'

import Link from 'next/link'

import ImageChecker from '@/components/ImageChecker'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function ImageCheckerPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">画像から薬機法チェック</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200">この機能をご利用いただくには、ログインが必要です。</p>
          </div>
          <div className="space-x-4">
            <Button asChild size="lg"><Link href="/auth/signin">サインイン</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/auth/signup">サインアップ</Link></Button>
          </div>
          <div className="mt-6">
            <Button asChild variant="link"><Link href="/">← トップページに戻る</Link></Button>
          </div>
        </div>
      </div>
    )
  }

  return <ImageChecker />
}


