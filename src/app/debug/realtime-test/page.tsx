'use client'

import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeTestPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isListening, setIsListening] = useState(false)
  const [checkId, setCheckId] = useState<number | null>(null)
  const { user } = useAuth()
  const supabase = createClient()

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const startListening = () => {
    if (isListening) return
    
    setIsListening(true)
    addLog('Starting realtime listener...')
    
    const channel = supabase.channel('checks-updates')
    
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checks'
      }, (payload) => {
        addLog(`Realtime event: ${payload.eventType}`)
        addLog(`Data: ${JSON.stringify(payload, null, 2)}`)
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          addLog('Successfully subscribed to checks table')
        } else if (status === 'CHANNEL_ERROR') {
          addLog(`Subscription error: ${err}`)
        } else {
          addLog(`Subscription status: ${status}`)
        }
      })
  }

  const stopListening = () => {
    if (!isListening) return
    
    setIsListening(false)
    addLog('Stopping realtime listener...')
    supabase.removeAllChannels()
  }

  const createTestCheck = async () => {
    try {
      addLog('Creating test check...')
      
      if (!user) {
        addLog('Error: User not authenticated')
        return
      }

      // Get user profile to get organization_id
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError || !userProfile) {
        addLog(`Error getting user profile: ${profileError?.message}`)
        return
      }
      
      const { data, error } = await supabase
        .from('checks')
        .insert({
          original_text: 'Test text for realtime',
          status: 'pending' as const,
          user_id: user.id,
          organization_id: userProfile.organization_id!
        })
        .select()
        .single()
      
      if (error) {
        addLog(`Error creating check: ${error.message}`)
        return
      }
      
      setCheckId(data.id)
      addLog(`Created check with ID: ${data.id}`)
      
      // Update the check after 2 seconds
      setTimeout(async () => {
        addLog('Updating check to processing...')
        const { error: updateError } = await supabase
          .from('checks')
          .update({
            status: 'processing',
            modified_text: 'Updated text'
          })
          .eq('id', data.id)
        
        if (updateError) {
          addLog(`Error updating check: ${updateError.message}`)
        } else {
          addLog('Updated check status to processing')
        }
      }, 2000)
      
      // Complete the check after 4 seconds
      setTimeout(async () => {
        addLog('Completing check...')
        const { error: completeError } = await supabase
          .from('checks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', data.id)
        
        if (completeError) {
          addLog(`Error completing check: ${completeError.message}`)
        } else {
          addLog('Completed check')
        }
      }, 4000)
      
    } catch (error) {
      addLog(`Exception: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  useEffect(() => {
    return () => {
      if (isListening) {
        supabase.removeAllChannels()
      }
    }
  }, [isListening, supabase])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>リアルタイム機能テスト</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={startListening} 
                disabled={isListening}
                variant={isListening ? "secondary" : "default"}
              >
                {isListening ? "リスニング中..." : "リスニング開始"}
              </Button>
              <Button 
                onClick={stopListening} 
                disabled={!isListening}
                variant="outline"
              >
                リスニング停止
              </Button>
              <Button 
                onClick={createTestCheck}
                disabled={!isListening}
                variant="outline"
              >
                テストチェック作成
              </Button>
              <Button 
                onClick={clearLogs}
                variant="destructive"
              >
                ログクリア
              </Button>
            </div>
            
            {checkId && (
              <div className="bg-blue-50 p-3 rounded">
                <strong>最新のCheck ID:</strong> {checkId}
              </div>
            )}
            
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">リアルタイムログ:</h3>
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
