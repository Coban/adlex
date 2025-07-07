'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'

export default function AuthTestPage() {
  const { user, userProfile, loading } = useAuth()
  const [renderCount, setRenderCount] = useState(0)

  useEffect(() => {
    setRenderCount(count => count + 1)
    console.log('AuthTestPage render #', renderCount + 1, {
      loading,
      hasUser: !!user,
      userId: user?.id,
      hasProfile: !!userProfile,
      timestamp: new Date().toISOString()
    })
  }, [loading, user, userProfile, renderCount])

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">認証状態テスト</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded bg-white">
          <h2 className="font-semibold mb-2 text-gray-900">基本状態</h2>
          <div className="text-gray-900">レンダー回数: {renderCount}</div>
          <div className="text-gray-900">Loading: {loading ? 'true' : 'false'}</div>
          <div className="text-gray-900">User: {user ? 'あり' : 'なし'}</div>
          <div className="text-gray-900">User ID: {user?.id || 'N/A'}</div>
          <div className="text-gray-900">User Email: {user?.email || 'N/A'}</div>
          <div className="text-gray-900">Is Anonymous: {user?.is_anonymous ? 'true' : 'false'}</div>
        </div>

        <div className="border p-4 rounded bg-white">
          <h2 className="font-semibold mb-2 text-gray-900">プロファイル</h2>
          <div className="text-gray-900">Profile: {userProfile ? 'あり' : 'なし'}</div>
          <div className="text-gray-900">Profile Email: {userProfile?.email || 'N/A'}</div>
          <div className="text-gray-900">Role: {userProfile?.role || 'N/A'}</div>
          <div className="text-gray-900">Organization ID: {userProfile?.organization_id || 'N/A'}</div>
        </div>

        {loading && (
          <div className="border border-yellow-400 bg-yellow-50 p-4 rounded">
            <div className="text-yellow-800">🔄 読み込み中...</div>
          </div>
        )}

        {!loading && !user && (
          <div className="border border-gray-400 bg-gray-50 p-4 rounded">
            <div className="text-gray-900">👤 未ログイン</div>
          </div>
        )}

        {!loading && user && (
          <div className="border border-green-400 bg-green-50 p-4 rounded">
            <div className="text-green-900">✅ ログイン済み</div>
          </div>
        )}
      </div>
    </div>
  )
}
