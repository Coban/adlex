'use client'

import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import TextChecker from '@/components/TextChecker'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'


export default function CheckerPage() {
  const { user, loading } = useAuth()
  const [doubleCheckedUser, setDoubleCheckedUser] = useState<User | null>(null)
  const [doubleChecking, setDoubleChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const doubleCheckAuth = async () => {
      try {
        console.log('CheckerPage: Double-checking auth state...')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('CheckerPage: Session check error:', error)
        } else {
          console.log('CheckerPage: Session check result:', session?.user?.id || 'no user')
          setDoubleCheckedUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('CheckerPage: Failed to double-check auth:', error)
        setDoubleCheckedUser(null)
      } finally {
        setDoubleChecking(false)
      }
    }

    // Wait a bit for auth context to settle, then double-check
    const timer = setTimeout(() => {
      doubleCheckAuth()
    }, 200)

    return () => clearTimeout(timer)
  }, [])

  const finalUser = doubleCheckedUser !== null ? doubleCheckedUser : user
  const finalLoading = loading || doubleChecking

  if (finalLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div>読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!finalUser) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">薬機法チェック & リライト</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              この機能をご利用いただくには、ログインが必要です。
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>Debug: AuthContext User: {user ? user.id : 'null'}</div>
                <div>Debug: Double-checked User: {doubleCheckedUser ? doubleCheckedUser.id : 'null'}</div>
                <div>Debug: Loading states: context={loading.toString()}, doubleCheck={doubleChecking.toString()}</div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link href="/auth/signin">サインイン</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/signup">サインアップ</Link>
              </Button>
            </div>
            
            <div>
              <Button asChild variant="ghost">
                <Link href="/debug/auth">開発者向けデバッグ（匿名ログイン）</Link>
              </Button>
            </div>
            
            <div className="mt-6">
              <Button asChild variant="link">
                <Link href="/">← トップページに戻る</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-green-50 border border-green-200 rounded p-2 mb-4">
          <div className="text-xs text-green-700">
            <div>認証済み - User ID: {finalUser?.id}</div>
            <div>Context User: {user?.id || 'null'}, Double-checked: {doubleCheckedUser?.id || 'null'}</div>
          </div>
        </div>
      )}
      <TextChecker />
    </div>
  )
}
