'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

export default function AuthDebugSimplePage(): React.JSX.Element {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionInfo, setSessionInfo] = useState<Session | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const initAuth = async () => {
      try {
        setDebugInfo('→ 認証状態確認中...')
        console.log('Initializing auth state...')
        
        // ユーザー情報を取得
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        console.log('Get user response:', { user, userError })
        setUser(user)
        
        // セッション情報を取得
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('Get session response:', { session, sessionError })
        setSessionInfo(session)
        
        setDebugInfo(prev => prev + `\n✓ 認証状態確認完了: ${user ? 'ログイン済み' : '未ログイン'}`)
        setDebugInfo(prev => prev + `\n✓ セッション状態: ${session ? 'あり' : 'なし'}`)
        
        setLoading(false)
      } catch (error) {
        console.error('Auth init error:', error)
        setDebugInfo(prev => prev + `\n✗ 認証エラー: ${error}`)
        setLoading(false)
      }
    }

    initAuth()
  }, [supabase, mounted])

  if (!mounted) {
    return <div>Loading...</div>
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        padding: '20px'
      }}>
        <div style={{ fontSize: '18px', color: '#374151' }}>読み込み中...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* ヘッダー */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827',
            margin: '0'
          }}>
            認証デバッグページ（簡易版）
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#374151',
            marginTop: '4px',
            margin: '4px 0 0 0'
          }}>
            AuthContextを使わない版の認証状態確認
          </p>
        </div>
        
        {/* 認証状態 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            認証状態
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '500' }}>ログイン状態:</span>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: user ? '#dcfce7' : '#fef2f2',
                color: user ? '#166534' : '#991b1b'
              }}>
                {user ? 'ログイン済み' : '未ログイン'}
              </span>
            </div>
            {user && (
              <>
                <div>
                  <span style={{ fontWeight: '500' }}>ユーザーID:</span> {user.id}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>メール:</span> {user.email || '匿名'}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>作成日:</span> {new Date(user.created_at).toLocaleString('ja-JP')}
                </div>
              </>
            )}
          </div>
        </div>

        {/* セッション情報 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            セッション情報
          </h2>
          {sessionInfo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div>
                <span style={{ fontWeight: '500' }}>アクセストークン:</span> あり ({sessionInfo.access_token?.length || 0}文字)
              </div>
              <div>
                <span style={{ fontWeight: '500' }}>有効期限:</span> {sessionInfo.expires_at ? new Date(sessionInfo.expires_at * 1000).toLocaleString('ja-JP') : '不明'}
              </div>
              <div>
                <span style={{ fontWeight: '500' }}>リフレッシュトークン:</span> {sessionInfo.refresh_token ? 'あり' : 'なし'}
              </div>
            </div>
          ) : (
            <div style={{ color: '#374151', fontSize: '14px' }}>セッション情報なし</div>
          )}
        </div>

        {/* デバッグログ */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px'
          }}>
            デバッグログ
          </h2>
          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            padding: '16px',
            minHeight: '200px',
            overflow: 'auto'
          }}>
            {debugInfo ? (
              <pre style={{
                fontSize: '14px',
                color: '#1f2937',
                whiteSpace: 'pre-wrap',
                margin: 0,
                fontFamily: 'monospace'
              }}>
                {debugInfo}
              </pre>
            ) : (
              <div style={{ color: '#374151', fontSize: '14px' }}>ログなし</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
