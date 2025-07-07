'use client'

import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Select component is not available, using native select
import { inviteUser, fetchOrganizationUsers, updateUserRole } from '@/lib/auth'

export default function UsersAdminPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [invitations, setInvitations] = useState<{
    id: number
    email: string
    role: string
    created_at: string
    accepted_at: string | null
    expires_at: string
  }[]>([])
  const [organizationUsers, setOrganizationUsers] = useState<{
    id: string
    email: string
    role: string
    created_at: string
    updated_at: string | null
  }[]>([])
  const [userUpdateLoading, setUserUpdateLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users')

  useEffect(() => {
    fetchInvitations()
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const data = await fetchOrganizationUsers()
      setOrganizationUsers(data.users || [])
    } catch (err) {
      console.error('ユーザー一覧の取得に失敗しました:', err)
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/users/invitations')
      if (response.ok) {
        const data = await response.json()
        setInvitations(data.invitations || [])
      }
    } catch (err) {
      console.error('招待リストの取得に失敗しました:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await inviteUser({ email, role })
      setMessage(`${email} に招待を送信しました`)
      setEmail('')
      setRole('user')
      
      // 招待リストを更新
      fetchInvitations()
      
      // 招待URLをコンソールに表示（デバッグ用）
      if (result.invitation?.invitation_url) {
        console.log('招待URL:', result.invitation.invitation_url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    setUserUpdateLoading(userId)
    try {
      await updateUserRole(userId, newRole)
      setMessage('ユーザーの権限を変更しました')
      
      // ユーザー一覧を更新
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setUserUpdateLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ページタイトルとパンくずリスト */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
            <p className="mt-1 text-sm text-gray-600">組織のユーザーを管理し、新しいメンバーを招待できます</p>
          </div>
        </div>
        {/* タブナビゲーション */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            組織ユーザー
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'invitations'
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            招待管理
          </button>
        </div>

        {/* ユーザー一覧 */}
        {activeTab === 'users' && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>組織ユーザー一覧</CardTitle>
              <CardDescription>
                組織に所属するユーザーの管理ができます
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="text-red-600 text-sm mb-4">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-green-600 text-sm mb-4">
                  {message}
                </div>
              )}
              
              {organizationUsers.length > 0 ? (
                <div className="space-y-4">
                  {organizationUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.email}</p>
                        <p className="text-sm text-gray-600">
                          現在の権限: {user.role === 'admin' ? '管理者' : 'ユーザー'}
                        </p>
                        <p className="text-sm text-gray-500">
                          登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'user')}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={userUpdateLoading === user.id}
                        >
                          <option value="user">ユーザー</option>
                          <option value="admin">管理者</option>
                        </select>
                        {userUpdateLoading === user.id && (
                          <div className="text-sm text-gray-500">更新中...</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  組織にユーザーがいません
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 招待管理 */}
        {activeTab === 'invitations' && (
          <>
            {/* ユーザー招待フォーム */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>ユーザー招待</CardTitle>
                <CardDescription>
                  新しいユーザーを組織に招待します
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">メールアドレス</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">ロール</Label>
                      <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                      >
                        <option value="user">ユーザー</option>
                        <option value="admin">管理者</option>
                      </select>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="text-red-600 text-sm">
                      {error}
                    </div>
                  )}
                  {message && (
                    <div className="text-green-600 text-sm">
                      {message}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? '招待送信中...' : '招待を送信'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* 招待リスト */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>送信済み招待</CardTitle>
                <CardDescription>
                  現在の招待状況を確認できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length > 0 ? (
                  <div className="space-y-4">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-gray-600">
                            ロール: {invitation.role === 'admin' ? '管理者' : 'ユーザー'}
                          </p>
                          <p className="text-sm text-gray-500">
                            送信日: {new Date(invitation.created_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs ${
                            invitation.accepted_at 
                              ? 'bg-green-100 text-green-800' 
                              : new Date(invitation.expires_at) < new Date()
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {invitation.accepted_at 
                              ? '承認済み' 
                              : new Date(invitation.expires_at) < new Date()
                              ? '期限切れ'
                              : '未承認'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    送信済みの招待がありません
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
} 