'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { signUpWithOrganization } from '@/lib/auth'

export default function OrganizationSignUpPage() {
  const [formData, setFormData] = useState({
    // ユーザー情報
    email: '',
    password: '',
    confirmPassword: '',
    // 組織情報
    organizationName: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      await signUpWithOrganization(formData)
      setMessage('組織とアカウントが作成されました。メールを確認してアカウントを有効化してください。')
      // フォームをクリア
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        organizationName: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">組織アカウント作成</CardTitle>
          <CardDescription className="text-center">
            新しい組織とアカウントを作成してください
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* 組織情報 */}
            <div className="space-y-2">
              <Label htmlFor="organizationName">組織名</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="組織名を入力"
                value={formData.organizationName}
                onChange={(e) => handleInputChange('organizationName', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">管理者情報</p>
              
              {/* ユーザー情報 */}
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="メールアドレスを入力"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">パスワード確認</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="パスワードを再入力"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
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
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '組織アカウント作成中...' : '組織アカウント作成'}
            </Button>
            <div className="text-center text-sm">
              すでにアカウントをお持ちですか？{' '}
              <Link
                href="/auth/signin"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                サインイン
              </Link>
            </div>
            <div className="text-center text-sm">
              個人アカウントを作成する場合は{' '}
              <Link
                href="/auth/signup"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                こちら
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 