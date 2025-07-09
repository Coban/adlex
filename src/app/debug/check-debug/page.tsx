'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

export default function CheckDebugPage() {
  const [text, setText] = useState('カルシウム サプリメントで健康に！')
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [checkId, setCheckId] = useState<number | null>(null)
  const { user } = useAuth()
  const supabase = createClient()

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const testCheck = async () => {
    if (!text.trim()) return
    
    setIsLoading(true)
    setLogs([])
    
    try {
      addLog('Starting check test...')
      
      if (!user) {
        addLog('ERROR: User not authenticated')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        addLog('ERROR: No session found')
        return
      }
      
      addLog('Sending check request...')
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        addLog(`ERROR: HTTP ${response.status} - ${errorData.error ?? 'Unknown error'}`)
        return
      }

      const checkData = await response.json()
      setCheckId(checkData.id)
      addLog(`Check created with ID: ${checkData.id}`)
      
      // Start monitoring the check
      monitorCheck(checkData.id)
      
    } catch (error) {
      addLog(`EXCEPTION: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const monitorCheck = (id: number) => {
    addLog(`Starting SSE monitoring for check ${id}...`)
    
    const eventSource = new EventSource(`/api/checks/${id}/stream`)
    let eventCount = 0
    
    eventSource.onopen = () => {
      addLog('SSE connection opened')
    }
    
    eventSource.onmessage = (event) => {
      eventCount++
      addLog(`SSE Event #${eventCount}: ${event.data}`)
      
      try {
        const data = JSON.parse(event.data)
        
        if (data.status === 'completed') {
          addLog('Check completed successfully!')
          addLog(`Modified text: ${data.modified_text}`)
          addLog(`Violations: ${data.violations?.length ?? 0}`)
          eventSource.close()
        } else if (data.status === 'failed') {
          addLog(`Check failed: ${data.error}`)
          eventSource.close()
        } else if (data.status === 'processing') {
          addLog('Check is processing...')
        }
      } catch (parseError) {
        addLog(`Failed to parse SSE data: ${parseError}`)
      }
    }
    
    eventSource.onerror = (error) => {
      addLog(`SSE error: ${error}`)
      eventSource.close()
    }
    
    // Timeout after 60 seconds
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        addLog('SSE timeout - closing connection')
        eventSource.close()
      }
    }, 60000)
  }

  const checkStatus = async () => {
    if (!checkId) {
      addLog('No check ID available')
      return
    }
    
    try {
      addLog(`Checking status for ID: ${checkId}`)
      
      const { data: check, error } = await supabase
        .from('checks')
        .select('*')
        .eq('id', checkId)
        .single()
      
      if (error) {
        addLog(`Database error: ${error.message}`)
        return
      }
      
      if (check) {
        addLog(`Status: ${check.status}`)
        addLog(`Modified text: ${check.modified_text ?? 'None'}`)
        addLog(`Error message: ${check.error_message ?? 'None'}`)
        addLog(`Completed at: ${check.completed_at ?? 'None'}`)
      } else {
        addLog('Check not found')
      }
    } catch (error) {
      addLog(`Exception checking status: ${error}`)
    }
  }

  const testLMStudio = async () => {
    try {
      addLog('Testing LM Studio connection...')
      
      const response = await fetch('/api/debug/lm-test')
      const data = await response.json()
      
      addLog(`LM Studio test result: ${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      addLog(`LM Studio test failed: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>チェック処理デバッグ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">テストテキスト:</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="チェックするテキストを入力..."
                rows={3}
              />
            </div>
            
            <div className="flex gap-4">
              <Button onClick={testCheck} disabled={isLoading || !user}>
                チェック実行
              </Button>
              <Button onClick={checkStatus} disabled={!checkId}>
                ステータス確認
              </Button>
              <Button onClick={testLMStudio} variant="outline">
                LM Studio テスト
              </Button>
            </div>
            
            {checkId && (
              <div className="bg-blue-50 p-3 rounded">
                <strong>Check ID:</strong> {checkId}
              </div>
            )}
            
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">デバッグログ:</h3>
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
