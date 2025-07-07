'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/hooks/use-supabase'

export default function Home() {
  const { user, loading } = useAuth()
  const { organization } = useOrganization()

  return (
    <div className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-8">
            <div>読み込み中...</div>
          </div>
        ) : user ? (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">ようこそ、{user.email}さん</h2>
            <p className="text-gray-600 mb-6">
              薬機法チェック & リライト機能をご利用いただけます。
            </p>
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link href="/checker">テキストチェックを開始</Link>
              </Button>
              {organization?.role === 'admin' && (
                <Button asChild variant="outline" size="lg">
                  <Link href="/admin/users">組織ユーザー管理</Link>
                </Button>
              )}
            </div>
            
            {organization?.role === 'admin' && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
                <h3 className="text-sm font-medium text-blue-900 mb-2">管理者機能</h3>
                <p className="text-xs text-blue-700">
                  組織のユーザーを管理し、権限を変更したり、新しいユーザーを招待できます。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">AdLex - 薬機法チェック & リライト</h2>
            <p className="text-gray-600 mb-6">
              テキストの薬機法違反をチェックし、安全な表現にリライトするAIツールです。<br/>
              本格的な機能を利用するには、サインインまたはサインアップが必要です。
            </p>
            
            {/* デモ機能の説明 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-3">🔍 主な機能</h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>• 薬機法に抵触する可能性のある表現を自動検出</li>
                <li>• AI による安全な表現への自動リライト</li>
                <li>• 変更箇所のハイライト表示</li>
                <li>• 修正理由の詳細説明</li>
                <li>• 結果のコピー・ダウンロード機能</li>
              </ul>
            </div>
            
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link href="/checker">テキストチェックを開始</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/signin">サインイン</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/signup">サインアップ</Link>
              </Button>
            </div>
            
            <div className="mt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/debug/auth">開発者向けデバッグ（匿名ログイン）</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
  )
}
