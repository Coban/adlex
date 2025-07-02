'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function AuthDiagnosticsPage() {
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const addOutput = (message: string) => {
    setOutput(prev => prev + message + '\n')
    console.log(message)
  }

  const clearLocalStorage = () => {
    setOutput('')
    addOutput('🧹 LocalStorageをクリア中...')
    
    // Supabase関連のLocalStorageアイテムをクリア
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('supabase') || key?.includes('sb-')) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      addOutput(`  削除: ${key}`)
    })
    
    addOutput('✅ LocalStorageクリア完了')
  }

  const testSupabaseConnection = async () => {
    setLoading(true)
    addOutput('\n🔍 Supabase接続テスト開始...')
    
    try {
      const supabase = createClient()
      
      // 1. 基本的な接続テスト
      addOutput('📡 基本接続テスト...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        addOutput(`❌ セッションエラー: ${sessionError.message}`)
      } else {
        addOutput(`✅ セッション取得成功: ${session ? 'セッションあり' : 'セッションなし'}`)
        if (session) {
          addOutput(`  ユーザーID: ${session.user.id}`)
          addOutput(`  匿名ユーザー: ${session.user.is_anonymous}`)
        }
      }

      // 2. 匿名ログインテスト
      addOutput('\n🔐 匿名ログインテスト...')
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      
      if (authError) {
        addOutput(`❌ 匿名ログインエラー: ${authError.message}`)
        addOutput(`  エラーコード: ${authError.status}`)
        addOutput(`  エラー詳細: ${JSON.stringify(authError, null, 2)}`)
      } else {
        addOutput(`✅ 匿名ログイン成功`)
        addOutput(`  ユーザーID: ${authData.user?.id}`)
        addOutput(`  セッション: ${authData.session ? 'あり' : 'なし'}`)
      }

      // 3. usersテーブルアクセステスト
      if (authData.user) {
        addOutput('\n📊 usersテーブルアクセステスト...')
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle()
        
        if (userError) {
          addOutput(`❌ usersテーブルエラー: ${userError.message}`)
          addOutput(`  エラーコード: ${userError.code}`)
        } else {
          addOutput(`✅ usersテーブルアクセス成功`)
          addOutput(`  データ: ${userData ? 'あり' : 'なし'}`)
        }
      }

    } catch (error) {
      addOutput(`💥 予期しないエラー: ${error}`)
    } finally {
      setLoading(false)
      addOutput('\n🏁 テスト完了')
    }
  }

  const checkEnvironment = () => {
    setOutput('')
    addOutput('🔧 環境変数チェック...')
    addOutput(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
    addOutput(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}...`)
    
    addOutput('\n📱 ブラウザ情報...')
    addOutput(`User Agent: ${navigator.userAgent}`)
    addOutput(`Current URL: ${window.location.href}`)
    
    addOutput('\n💾 LocalStorage内容...')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        const value = localStorage.getItem(key)
        addOutput(`  ${key}: ${value?.substring(0, 50)}...`)
      }
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">認証診断ツール</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={checkEnvironment}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          環境チェック
        </button>
        
        <button
          onClick={clearLocalStorage}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
        >
          LocalStorageクリア
        </button>
        
        <button
          onClick={testSupabaseConnection}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '実行中...' : 'Supabase接続テスト'}
        </button>
      </div>

      <div className="border rounded p-4 bg-white min-h-96 shadow-sm">
        <h2 className="font-semibold mb-2 text-gray-900">出力:</h2>
        {output ? (
          <pre className="text-sm font-mono whitespace-pre-wrap text-black">{output}</pre>
        ) : (
          <div className="text-gray-700 text-sm italic">ボタンをクリックして診断を開始してください</div>
        )}
      </div>
    </div>
  )
}
