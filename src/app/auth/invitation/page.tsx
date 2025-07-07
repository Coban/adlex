'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpWithInvitation } from '@/lib/auth'

function InvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [token] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [invitationInfo, setInvitationInfo] = useState<{
    email: string
    organizationName: string
    role: string
  } | null>(null)

  const fetchInvitationInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/invitation-info?token=${token}`)
      if (response.ok) {
        const data = await response.json()
        setInvitationInfo(data)
      } else {
        setError('無効または期限切れの招待リンクです')
      }
    } catch {
      setError('招待情報の取得に失敗しました')
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setError('招待トークンが見つかりません')
      return
    }

    // 招待情報を取得（実装を簡略化）
    fetchInvitationInfo()
  }, [token, fetchInvitationInfo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      await signUpWithInvitation(token, password, confirmPassword)
      setMessage('アカウントが作成されました。メールを確認してアカウントを有効化してください。')
      
      // 数秒後にサインインページにリダイレクト
      setTimeout(() => {
        router.push('/auth/signin')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-red-600">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">招待リンクが無効です。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">招待を承認</CardTitle>
          <CardDescription className="text-center">
            {invitationInfo ? (
              <>
                <span className="font-medium">{invitationInfo.organizationName}</span> への招待
                <br />
                メールアドレス: <span className="font-medium">{invitationInfo.email}</span>
                <br />
                ロール: <span className="font-medium">{invitationInfo.role === 'admin' ? '管理者' : 'ユーザー'}</span>
              </>
            ) : (
              '招待情報を読み込み中...'
            )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || !invitationInfo}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード確認</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="パスワードを再入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading || !invitationInfo}
                minLength={6}
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}
            {message && (
              <div className="text-green-600 text-sm text-center">
                {message}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !invitationInfo}
            >
              {isLoading ? 'アカウント作成中...' : '招待を承認'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function InvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    }>
      <InvitationContent />
    </Suspense>
  )
} 