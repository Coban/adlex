'use client'

import { Settings, Users, HelpCircle, BarChart3 } from 'lucide-react'
import Link from 'next/link'

import { DashboardStats } from '@/components/admin/DashboardStats'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminDashboard() {
  const { userProfile, loading: authLoading } = useAuth()

  if (authLoading) {
    return <div className="p-6">読み込み中...</div>
  }

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">アクセスが拒否されました</h1>
          <p>このページにアクセスするには管理者権限が必要です。</p>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-4 text-xs text-gray-500 text-left">
              Debug: userProfile={JSON.stringify(userProfile, null, 2)}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">管理ダッシュボード</h1>
          <p className="text-muted-foreground">システム全体の統計情報と管理機能</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              ユーザー管理
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              組織設定
            </Button>
          </Link>
          <Link href="/admin/system-settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              システム設定
            </Button>
          </Link>
          <Link href="/admin/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              分析レポート
            </Button>
          </Link>
          <Link href="/admin/support">
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4 mr-2" />
              サポート
            </Button>
          </Link>
        </div>
      </div>

      <DashboardStats />
    </div>
  )
}