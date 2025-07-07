'use client'

import { Loader2, Copy, Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

interface CheckItem {
  id: string
  originalText: string
  result: CheckResult | null
  status: 'queued' | 'processing' | 'completed' | 'failed'
  statusMessage: string
  timestamp: number
}

interface Violation {
  id: number
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
}

interface CheckStreamData {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  id?: number
  original_text?: string
  modified_text?: string
  violations?: Violation[]
}

interface CheckResult {
  id: number
  original_text: string
  modified_text: string
  status: string
  violations: Violation[]
}

export default function TextChecker() {
  const [originalText, setOriginalText] = useState('')
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null)
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('side-by-side')
  const { user } = useAuth()

  const handleCheck = async () => {
    if (!originalText.trim()) return
    
    if (originalText.length > 10000) {
      alert('テキストは10,000文字以内で入力してください。')
      return
    }

    // 新しいチェックアイテムを作成
    const checkId = Date.now().toString()
    const newCheckItem: CheckItem = {
      id: checkId,
      originalText: originalText,
      result: null,
      status: 'queued',
      statusMessage: 'チェックをキューに追加しています...',
      timestamp: Date.now()
    }

    // チェックリストに追加
    setChecks(prev => [...prev, newCheckItem])
    setActiveCheckId(checkId)
    
    // 入力欄をクリア（次の入力の準備）
    setOriginalText('')
    
    try {
      // Check if user is authenticated using AuthContext
      if (!user) {
        throw new Error('認証が必要です。サインインしてください。')
      }

      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('認証セッションが見つかりません。再度サインインしてください。')
      }

      // ステータス更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, statusMessage: 'チェックリクエストを送信中...' }
          : check
      ))

      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: newCheckItem.originalText }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error ?? `HTTPエラー: ${response.status}`
        throw new Error(errorMessage)
      }

      const checkData = await response.json()
      
      if (!checkData.id) {
        throw new Error('チェックIDが取得できませんでした')
      }
      
      // ステータス更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { 
              ...check, 
              status: 'processing',
              statusMessage: 'AIによるテキスト解析を実行中...' 
            }
          : check
      ))
      
      // SSEで結果を待機
      const eventSource = new EventSource(`/api/checks/${checkData.id}/stream`)
      
      // タイムアウト設定（30秒）
      const timeout = setTimeout(() => {
        eventSource.close()
        setChecks(prev => prev.map(check => 
          check.id === checkId 
            ? { 
                ...check, 
                status: 'failed',
                statusMessage: '処理がタイムアウトしました' 
              }
            : check
        ))
        alert('処理がタイムアウトしました。もう一度お試しください。')
      }, 30000)
      
      eventSource.onmessage = (event) => {
        try {
          const data: CheckStreamData = JSON.parse(event.data)
          
          if (data.status === 'completed') {
            clearTimeout(timeout)
            setChecks(prev => prev.map(check => 
              check.id === checkId 
                ? { 
                    ...check, 
                    result: data as CheckResult,
                    status: 'completed',
                    statusMessage: 'チェック完了' 
                  }
                : check
            ))
            eventSource.close()
          } else if (data.status === 'failed') {
            clearTimeout(timeout)
            const errorMessage = data.error ?? 'チェック処理が失敗しました'
            console.error('Check failed:', errorMessage)
            setChecks(prev => prev.map(check => 
              check.id === checkId 
                ? { 
                    ...check, 
                    status: 'failed',
                    statusMessage: `エラー: ${errorMessage}` 
                  }
                : check
            ))
            alert(`エラー: ${errorMessage}`)
            eventSource.close()
          } else if (data.status === 'processing') {
            setChecks(prev => prev.map(check => 
              check.id === checkId 
                ? { 
                    ...check, 
                    status: 'processing',
                    statusMessage: '薬機法違反の検出と修正を実行中...' 
                  }
                : check
            ))
            console.log('Processing...')
          }
        } catch (parseError) {
          clearTimeout(timeout)
          console.error('Failed to parse SSE data:', parseError, 'Raw data:', event.data)
          setChecks(prev => prev.map(check => 
            check.id === checkId 
              ? { 
                  ...check, 
                  status: 'failed',
                  statusMessage: 'データ解析エラー' 
                }
              : check
          ))
          eventSource.close()
        }
      }

      eventSource.onerror = (error) => {
        clearTimeout(timeout)
        console.error('SSE connection error:', error)
        setChecks(prev => prev.map(check => 
          check.id === checkId 
            ? { 
                ...check, 
                status: 'failed',
                statusMessage: 'サーバー接続エラー' 
              }
            : check
        ))
        eventSource.close()
        alert('サーバーとの接続でエラーが発生しました。もう一度お試しください。')
      }

    } catch (error) {
      console.error('Error during check:', error)
      
      const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました'
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { 
              ...check, 
              status: 'failed',
              statusMessage: `エラー: ${errorMessage}` 
            }
          : check
      ))
      alert(`エラー: ${errorMessage}`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Add toast notification
  }

  const highlightText = (text: string, violations: Violation[]) => {
    if (!violations.length) return text
    
    let highlightedText = text
    // Sort violations by start position in reverse order to maintain indices
    const sortedViolations = [...violations].sort((a, b) => b.start_pos - a.start_pos)
    
    sortedViolations.forEach((violation) => {
      const before = highlightedText.slice(0, violation.start_pos)
      const highlighted = highlightedText.slice(violation.start_pos, violation.end_pos)
      const after = highlightedText.slice(violation.end_pos)
      
      highlightedText = before + 
        `<span class="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold border border-red-300" title="${violation.reason}">` + 
        highlighted + 
        '</span>' + 
        after
    })
    
    return highlightedText
  }

  const getDiffView = (result: CheckResult) => {
    if (!result) return null
    
    // Simple diff implementation
    const originalLines = result.original_text.split('\n')
    const modifiedLines = result.modified_text.split('\n')
    
    return (
      <div className="space-y-2">
        {Math.max(originalLines.length, modifiedLines.length) > 0 && 
          Array.from({ length: Math.max(originalLines.length, modifiedLines.length) }).map((_, i) => (
            <div key={i} className="flex">
              <div className="w-1/2 border-r pr-4">
                {originalLines[i] && (
                  <div className={originalLines[i] !== modifiedLines[i] ? 'bg-red-50 p-3 rounded text-base leading-relaxed text-gray-900' : 'p-3 text-base leading-relaxed text-gray-900'}>
                    {originalLines[i]}
                  </div>
                )}
              </div>
              <div className="w-1/2 pl-4">
                {modifiedLines[i] && (
                  <div className={originalLines[i] !== modifiedLines[i] ? 'bg-green-50 p-3 rounded text-base leading-relaxed text-gray-900' : 'p-3 text-base leading-relaxed text-gray-900'}>
                    {modifiedLines[i]}
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>
    )
  }

  // アクティブなチェック結果を取得
  const activeCheck = activeCheckId ? checks.find(check => check.id === activeCheckId) : null
  const hasActiveCheck = activeCheck?.result
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-4">薬機法チェック & リライト</h1>
        <p className="text-gray-600 text-center">
          テキストを入力して薬機法に抵触する表現をチェックし、安全な表現にリライトします
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 入力エリア */}
        <div className="space-y-4">
          <div>
            <label htmlFor="original-text" className="block text-sm font-medium mb-2">
              チェックするテキスト（最大10,000文字）
            </label>
            <Textarea
              id="original-text"
              placeholder="ここにテキストを入力してください..."
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              className="min-h-[400px] resize-none"
              maxLength={10000}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-500">
                {originalText.length.toLocaleString()} / 10,000文字
              </span>
              <Button
                onClick={handleCheck}
                disabled={!originalText.trim()}
                className="min-w-[120px]"
              >
                チェック開始
              </Button>
            </div>
            
            {/* チェック履歴 */}
            {checks.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-700">チェック履歴</h3>
                {checks.slice().reverse().map((check) => (
                  <div 
                    key={check.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      activeCheckId === check.id 
                        ? 'bg-blue-100 border-blue-300' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveCheckId(check.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">
                          {check.originalText.substring(0, 50)}
                          {check.originalText.length > 50 ? '...' : ''}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex items-center space-x-1">
                            {check.status === 'queued' && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                            {check.status === 'processing' && (
                              <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                            )}
                            {check.status === 'completed' && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                            {check.status === 'failed' && (
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            )}
                            <span className="text-xs text-gray-500">{check.statusMessage}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(check.timestamp).toLocaleTimeString('ja-JP', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 結果エリア */}
        <div className="space-y-4">
          {hasActiveCheck ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">チェック結果</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activeCheck?.result && copyToClipboard(activeCheck.result.modified_text)}
                  >
                    <Copy className="w-4 h-4" />
                    コピー
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="side-by-side">並列表示</TabsTrigger>
                  <TabsTrigger value="diff">差分表示</TabsTrigger>
                  <TabsTrigger value="violations">違反詳細</TabsTrigger>
                </TabsList>

                <TabsContent value="side-by-side" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">元のテキスト</h3>
                      <div 
                        className="border rounded p-4 min-h-[300px] bg-gray-50 text-base leading-relaxed font-medium text-gray-900"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(activeCheck.result!.original_text, activeCheck.result!.violations)
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">修正されたテキスト</h3>
                      <div className="border rounded p-4 min-h-[300px] bg-green-50 text-base leading-relaxed font-medium text-gray-900 whitespace-pre-wrap">
                        {activeCheck.result!.modified_text}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="diff" className="mt-4">
                  <div className="border rounded p-4 min-h-[300px] bg-gray-50 text-base leading-relaxed text-gray-900">
                    {getDiffView(activeCheck.result!)}
                  </div>
                </TabsContent>

                <TabsContent value="violations" className="mt-4">
                  <div className="space-y-4">
                    {activeCheck.result!.violations.length > 0 ? (
                      activeCheck.result!.violations.map((violation, index) => (
                        <div key={violation.id || index} className="border rounded p-4 bg-red-50">
                          <div className="font-medium text-red-800 mb-2 text-lg">
                            違反箇所 {index + 1}
                          </div>
                          <div className="text-base text-red-700 mb-2 font-medium">
                            位置: {violation.start_pos} - {violation.end_pos}
                          </div>
                          <div className="text-base mb-2 leading-relaxed text-gray-900">
                            <strong>該当テキスト:</strong>{' '}
                            &ldquo;{activeCheck.result!.original_text.slice(violation.start_pos, violation.end_pos)}&rdquo;
                          </div>
                          <div className="text-base leading-relaxed text-gray-900">
                            <strong>理由:</strong> {violation.reason}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-700 text-base font-medium">
                        違反は検出されませんでした
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="border rounded p-8 text-center text-gray-500">
              左側のテキストエリアにテキストを入力し、「チェック開始」ボタンを押してください
              {checks.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm">チェック履歴から結果を選択して表示できます</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
