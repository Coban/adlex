'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function SignOutTestPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const testSignOut = async () => {
    setIsLoading(true)
    setLogs([])
    
    try {
      const supabase = createClient()
      
      addLog('Starting signOut test...')
      
      // 現在のセッションを確認
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      addLog(`Current session: ${session ? 'exists' : 'none'}, error: ${sessionError ? sessionError.message : 'none'}`)
      
      if (session) {
        addLog(`Session user: ${session.user.email}, expires: ${session.expires_at}`)
      }
      
      // サインアウト実行
      addLog('Executing signOut...')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        addLog(`SignOut error: ${error.message}`)
        addLog(`Error status: ${error.status}`)
        addLog(`Error code: ${error.code}`)
        addLog(`Full error: ${JSON.stringify(error, null, 2)}`)
      } else {
        addLog('SignOut successful')
      }
      
      // サインアウト後のセッションを確認
      const { data: { session: newSession }, error: newSessionError } = await supabase.auth.getSession()
      addLog(`Post-signOut session: ${newSession ? 'exists' : 'none'}, error: ${newSessionError ? newSessionError.message : 'none'}`)
      
    } catch (err) {
      addLog(`Exception: ${err}`)
      console.error('SignOut test exception:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const checkAuthStatus = async () => {
    const supabase = createClient()
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      addLog(`Current user: ${user ? user.email : 'none'}, error: ${userError ? userError.message : 'none'}`)
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      addLog(`Current session: ${session ? 'exists' : 'none'}, error: ${sessionError ? sessionError.message : 'none'}`)
    } catch (err) {
      addLog(`Auth check exception: ${err}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>サインアウトテスト</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={checkAuthStatus} disabled={isLoading}>
                認証状態確認
              </Button>
              <Button onClick={testSignOut} disabled={isLoading}>
                サインアウトテスト
              </Button>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">ログ:</h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500">ログなし</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-sm font-mono">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
