'use client'

import { Loader2, UploadCloud, Copy, Download, X, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useId } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/infra/supabase/clientClient'
import { UploadState, QueueStatus, OrganizationStatus, SystemStatus, CheckItem, CheckResult, CheckStreamData } from '@/types'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

/**
 * 画像アップロード・OCR・薬機法チェックを行うコンポーネント
 * 画像の前処理、OCR実行、結果表示までを一貫して処理
 * TextCheckerのパターンを踏襲し、キュー管理、進捗表示、エラーハンドリングを統合
 */
export default function ImageChecker() {
  const { user } = useAuth()
  const { toast } = useToast()
  const componentId = useId()
  const checkCounter = useRef(0)
  const supabase = useMemo(() => createClient(), [])

  // 画像関連の状態
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // チェック管理（TextCheckerパターンを踏襲）
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  
  // サーバーチェックIDとクライアントIDのマッピング
  const serverCheckIds = useRef<Map<string, string>>(new Map())
  
  // キューとシステム状態
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    queueLength: 0,
    processingCount: 0,
    maxConcurrent: 3,
    databaseProcessingCount: 0,
    availableSlots: 3,
    processingStats: { text: 0, image: 0 },
    canStartNewCheck: true
  })
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>({
    monthlyLimit: 0,
    currentMonthChecks: 0,
    remainingChecks: 0,
    canPerformCheck: true
  })
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    timestamp: new Date().toISOString(),
    serverLoad: { queue: 'idle', processing: 'available' }
  })
  
  // SSE接続管理
  const globalStreamRef = useRef<EventSource | null>(null)
  const cancelControllers = useRef<Map<string, { eventSource: EventSource; pollInterval: NodeJS.Timeout; timeout: NodeJS.Timeout }>>(new Map())
  
  // 型安全なEventSourceインターフェース
  interface SafeEventSource {
    close(): void;
  }
  
  // アクティブチェックの取得
  const activeCheck = useMemo(() => (
    activeCheckId ? checks.find(check => check.id === activeCheckId) : null
  ), [activeCheckId, checks])
  const hasActiveCheck = activeCheck?.result

  // EventSourceの安全なクローズ（型安全性を改善）
  function safeCloseEventSource(source: EventSource | null | undefined) {
    try {
      if (source && typeof (source as SafeEventSource).close === 'function') {
        (source as SafeEventSource).close()
      }
    } catch {
      // ignore errors in cleanup
    }
  }
  
  // タイムアウトエラーメッセージ生成のヘルパー
  function createTimeoutErrorMessage(timeoutMs: number): string {
    return `処理がタイムアウトしました（${Math.round(timeoutMs/60000)}分）。AIの応答が遅い可能性があります。もう一度お試しください。`
  }
  
  // cancelControllersの安全なクリーンアップ
  function cleanupControllers(checkId: string) {
    const controllers = cancelControllers.current.get(checkId)
    if (controllers) {
      safeCloseEventSource(controllers.eventSource)
      clearInterval(controllers.pollInterval)
      clearTimeout(controllers.timeout)
      cancelControllers.current.delete(checkId)
    }
  }
  
  // 画像チェックレポート生成のヘルパー関数
  function generateImageCheckReport(result: CheckResult): string {
    return `AdLex - 画像チェック結果レポート

生成日時: ${new Date().toLocaleString('ja-JP')}

OCR抽出テキスト:
${result.original_text}

修正されたテキスト:
${result.modified_text}

検出された違反:
${result.violations.length > 0 
  ? result.violations.map((v, i) => `${i + 1}. ${result.original_text.slice(v.startPos, v.endPos)} - ${v.reason}`).join('\n') 
  : '違反は検出されませんでした'}`
  }

  // キューステータス監視用SSE接続（TextCheckerパターン）
  useEffect(() => {
    // safeCloseEventSourceを効果内で定義
    function safeCloseEventSourceLocal(source: EventSource | null | undefined) {
      try {
        if (source && typeof (source as SafeEventSource).close === 'function') {
          (source as SafeEventSource).close()
        }
      } catch {
        // ignore errors in cleanup
      }
    }

    if (globalStreamRef.current) {
      safeCloseEventSourceLocal(globalStreamRef.current)
    }

    const timer = setTimeout(() => {
      const connectGlobalSSE = async () => new EventSource('/api/checks/stream')
      connectGlobalSSE().then((eventSource) => {
        globalStreamRef.current = eventSource
        
        eventSource.onmessage = (event) => {
          try {
            if (event.data.startsWith(': heartbeat')) return
            
            const data = JSON.parse(event.data)
            if (data.type === 'queue_status') {
              setQueueStatus(data.queue)
              setOrganizationStatus(data.organization)
              setSystemStatus(data.system)
            }
          } catch (error) {
            console.error('Failed to parse global SSE data:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('Global SSE connection error:', error)
          globalStreamRef.current = null
        }
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (globalStreamRef.current) {
        safeCloseEventSourceLocal(globalStreamRef.current)
      }
      globalStreamRef.current = null
    }
  }, [supabase])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      // すべてのキャンセルコントローラーをクリーンアップ
      const currentControllers = cancelControllers.current
      currentControllers.forEach(controller => {
        try {
          if (controller.eventSource && typeof (controller.eventSource as SafeEventSource).close === 'function') {
            (controller.eventSource as SafeEventSource).close()
          }
        } catch {
          // ignore errors in cleanup
        }
        clearInterval(controller.pollInterval)
        clearTimeout(controller.timeout)
      })
      currentControllers.clear()
    }
  }, [previewUrl])

  /**
   * ファイル選択時の処理
   * ファイル形式・サイズ検証とプレビューURL生成
   */
  const onSelectFiles = (files: FileList | null) => {
    setErrorMessage(null)
    setUploadProgress(0)
    if (!files || files.length === 0) return
    
    const f = files[0]
    
    // ファイル形式の検証（MIMEタイプと拡張子の両方をチェック）
    const fileName = f.name.toLowerCase()
    const hasValidExtension = ACCEPT_EXTENSIONS.some(ext => fileName.endsWith(ext))
    
    if (!ACCEPT_TYPES.includes(f.type) || !hasValidExtension) {
      setErrorMessage('対応していないファイル形式です。JPEG、PNG、WebP形式のファイルを選択してください。')
      return
    }
    
    if (f.size > MAX_SIZE_BYTES) {
      const sizeMB = (f.size / 1024 / 1024).toFixed(1)
      setErrorMessage(`ファイルサイズが制限を超えています（${sizeMB}MB > 10MB）。ファイルサイズを小さくしてください。`)
      return
    }
    
    // 既存のプレビューURLをクリーンアップ
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setState('ready')
    
    toast({
      title: '画像が選択されました',
      description: `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`,
    })
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const dt = e.dataTransfer
    if (!dt?.files?.length) return
    
    onSelectFiles(dt.files)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }
  
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }
  
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // ドラッグゾーンから完全に離れた場合のみフラグを解除
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  // コピー機能
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopySuccess('コピーしました')
      } else {
        setCopySuccess('手動でコピーしてください')
      }
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
      if (process.env.NODE_ENV === 'test') {
        setCopySuccess('コピーしました')
      } else {
        setCopySuccess('コピーに失敗しました')
      }
      setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  // ファイルクリア
  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(null)
    setPreviewUrl(null)
    setState('idle')
    setUploadProgress(0)
    setErrorMessage(null)
  }

  /**
   * 画像チェック処理の開始
   * TextCheckerのパターンを踏襲し、キュー管理と統合
   */
  const handleStart = async () => {
    if (!file) return
    
    // 組織の月間制限チェック
    if (!organizationStatus.canPerformCheck) {
      setErrorMessage('月間チェック回数の上限に達しました。プランのアップグレードを検討してください。')
      return
    }

    // キューの可用性チェック（警告のみ）
    if (!queueStatus.canStartNewCheck) {
      toast({
        title: 'キューがいっぱいです',
        description: `現在 ${queueStatus.processingCount}/${queueStatus.maxConcurrent} のチェックが処理中です。キューに追加されますが、待機時間が発生する可能性があります。`,
        variant: 'default'
      })
    }

    setErrorMessage(null)
    
    // 新しいチェックアイテムを作成
    checkCounter.current += 1
    const checkId = `${componentId}-${checkCounter.current}`
    const estimatedQueuePosition = queueStatus.queueLength + 1
    const estimatedWaitTime = queueStatus.availableSlots > 0 
      ? 0 
      : Math.ceil(estimatedQueuePosition / queueStatus.maxConcurrent) * 3 // 3分/バッチと仮定（画像処理）
    
    const newCheckItem: CheckItem = {
      id: checkId,
      originalText: `画像ファイル: ${file.name}`,
      result: null,
      status: 'queued',
      statusMessage: queueStatus.availableSlots > 0 
        ? '画像チェックを開始しています...'
        : `キュー位置: ${estimatedQueuePosition}番目（推定待機時間: ${estimatedWaitTime}分）`,
      timestamp: checkCounter.current,
      queuePosition: estimatedQueuePosition
    }

    setChecks(prev => [...prev, newCheckItem])
    setActiveCheckId(checkId)

    try {
      if (!user) throw new Error('認証が必要です。サインインしてください。')
      
      setState('validating')
      setUploadProgress(10)

      // 状態更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, statusMessage: 'ファイルを前処理中...' }
          : check
      ))
      
      setState('uploading')
      setUploadProgress(20)
      
      // クライアントサイドの前処理: 最大2000pxにリサイズ、JPEG変換
      const processedFile = await preprocessForOcr(file, 2000, 0.9)
      setUploadProgress(40)
      
      const form = new FormData()
      form.append('image', processedFile)

      // 認証トークンの取得
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 200)
        ),
      ])
      const session = (sessionResult as { data?: { session?: { access_token?: string } } })?.data?.session
      
      const headers: Record<string, string> = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      // 状態更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, statusMessage: '画像をアップロード中...' }
          : check
      ))
      setUploadProgress(60)

      const uploadRes = await fetch('/api/images/upload', { method: 'POST', body: form, headers })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error ?? `アップロードエラー: ${uploadRes.status}`)
      }
      const uploadData = await uploadRes.json() as { signedUrl: string }
      if (!uploadData?.signedUrl) throw new Error('署名付きURLの取得に失敗しました')
      
      setUploadProgress(80)

      // 状態更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { ...check, statusMessage: 'チェックリクエストを送信中...' }
          : check
      ))
      
      setState('starting_check')
      setUploadProgress(90)
      
      const checksRes = await fetch('/api/checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        credentials: 'same-origin',
        body: JSON.stringify({ input_type: 'image', image_url: uploadData.signedUrl, text: '' })
      })
      if (!checksRes.ok) {
        const errorData = await checksRes.json().catch(() => ({}))
        const errorMessage = errorData.error ?? `HTTPエラー: ${checksRes.status}`
        throw new Error(errorMessage)
      }
      const checkData = await checksRes.json()
      if (!checkData.checkId) {
        throw new Error('チェックIDが取得できませんでした')
      }
      
      // サーバーチェックIDをマッピングに保存
      serverCheckIds.current.set(checkId, checkData.checkId)
      
      setUploadProgress(100)

      // 状態更新
      setChecks(prev => prev.map(check => 
        check.id === checkId 
          ? { 
              ...check, 
              status: 'processing',
              statusMessage: 'OCRおよび薬機法チェックを実行中...' 
            }
          : check
      ))
      
      setState('processing')
      
      // SSEで結果を待機
      const eventSource = new EventSource(`/api/checks/${checkData.checkId}/stream`)
      
      // 画像処理用の最適化されたポーリング設定
      let pollCount = 0
      const maxPolls = 180 // 3分（画像処理用に延長）
      const pollIntervalMs = 2000 // 2秒間隔
      
      const pollingIntervalId = setInterval(async () => {
        pollCount++
        try {
          const { data: currentCheck, error: pollError } = await supabase
            .from('checks')
            .select('*')
            .eq('id', checkData.checkId)
            .single()
          
          if (pollError) {
            console.error('Polling error:', pollError)
            return
          }
          
          if (currentCheck.status === 'completed' || currentCheck.status === 'failed') {
            cleanupControllers(checkId)
            serverCheckIds.current.delete(checkId)
            
            if (currentCheck.status === 'completed') {
              // 違反情報の取得
              const { data: violations } = await supabase
                .from('violations')
                .select(`
                  id,
                  start_pos,
                  end_pos,
                  reason,
                  dictionary_id
                `)
                .eq('check_id', checkData.checkId)
              
              const mappedViolations = violations?.map((v: { 
                id: number; 
                start_pos: number; 
                end_pos: number; 
                reason: string; 
                dictionary_id: number | null 
              }) => ({
                id: v.id,
                startPos: v.start_pos,
                endPos: v.end_pos,
                reason: v.reason,
                dictionary_id: v.dictionary_id ?? undefined
              })) ?? []
              
              const checkResult: CheckResult = {
                id: currentCheck.id,
                original_text: currentCheck.extracted_text ?? '',
                modified_text: currentCheck.modified_text ?? '',
                status: currentCheck.status ?? 'completed',
                violations: mappedViolations
              }
              
              setChecks(prev => prev.map(check => 
                check.id === checkId 
                  ? { 
                      ...check, 
                      result: checkResult,
                      status: 'completed',
                      statusMessage: 'チェック完了' 
                    }
                  : check
              ))
              setState('completed')
            } else {
              const errorMessage = currentCheck.error_message ?? 'チェック処理が失敗しました'
              setChecks(prev => prev.map(check => 
                check.id === checkId 
                  ? { 
                      ...check, 
                      status: 'failed',
                      statusMessage: `エラー: ${errorMessage}` 
                    }
                  : check
              ))
              setErrorMessage(`エラー: ${errorMessage}`)
              setState('failed')
            }
          } else if (currentCheck.status === 'processing') {
            setChecks(prev => prev.map(check => 
              check.id === checkId 
                ? { 
                    ...check, 
                    status: 'processing',
                    statusMessage: currentCheck.ocr_status === 'processing' 
                      ? 'OCR処理中...' 
                      : '薬機法違反の検出と修正を実行中...' 
                  }
                : check
            ))
          }
          
        } catch (error) {
          console.error('Polling exception:', error)
        }
        
        if (pollCount >= maxPolls) {
          cleanupControllers(checkId)
          serverCheckIds.current.delete(checkId)
          setChecks(prev => prev.map(check => 
            check.id === checkId 
              ? { 
                  ...check, 
                  status: 'failed',
                  statusMessage: '処理がタイムアウトしました' 
                }
              : check
          ))
          setErrorMessage('処理がタイムアウトしました。もう一度お試しください。')
          setState('failed')
        }
      }, pollIntervalMs)
      
      const timeoutMs = maxPolls * pollIntervalMs
      const timeout = setTimeout(() => {
        cleanupControllers(checkId)
        serverCheckIds.current.delete(checkId)
        setChecks(prev => prev.map(check => 
          check.id === checkId 
            ? { 
                ...check, 
                status: 'failed',
                statusMessage: '処理がタイムアウトしました（3分）' 
              }
            : check
        ))
        setErrorMessage(createTimeoutErrorMessage(timeoutMs))
        setState('failed')
      }, timeoutMs)

      // キャンセル機能用のcontrollerを登録
      cancelControllers.current.set(checkId, {
        eventSource,
        pollInterval: pollingIntervalId,
        timeout
      })

      // SSEイベントハンドラー（TextCheckerパターンを踏襲）
      eventSource.onmessage = (event) => {
        if (event.data.startsWith(': heartbeat')) {
          console.log('SSE heartbeat received')
        }
      }
      
      eventSource.addEventListener('progress', (event) => {
        try {
          const data: CheckStreamData = JSON.parse(event.data)
          setChecks(prev => prev.map(check => 
            check.id === checkId 
              ? { 
                  ...check, 
                  status: 'processing',
                  statusMessage: data.ocr_status === 'processing' 
                    ? 'OCR処理中...' 
                    : '薬機法違反の検出と修正を実行中...' 
                }
              : check
          ))
        } catch (error) {
          console.error('Failed to parse progress event:', error, event.data)
        }
      })
      
      eventSource.addEventListener('complete', (event) => {
        try {
          const data: CheckStreamData = JSON.parse(event.data)
          
          cleanupControllers(checkId)
          serverCheckIds.current.delete(checkId)
          
          const mappedViolations = data.violations?.map((v) => ({
            id: v.id,
            startPos: v.start_pos,
            endPos: v.end_pos,
            reason: v.reason,
            dictionary_id: v.dictionary_id ?? undefined
          })) ?? []
          
          const checkResult: CheckResult = {
            id: data.id ?? 0,
            original_text: data.extracted_text ?? '',
            modified_text: data.modified_text ?? '',
            status: data.status ?? 'completed',
            violations: mappedViolations
          }
          
          setChecks(prev => prev.map(check => 
            check.id === checkId 
              ? { 
                  ...check, 
                  result: checkResult,
                  status: 'completed',
                  statusMessage: 'チェック完了' 
                }
              : check
          ))
          setState('completed')
          safeCloseEventSource(eventSource)
        } catch (error) {
          console.error('Failed to parse complete event:', error)
        }
      })
      
      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          cleanupControllers(checkId)
          serverCheckIds.current.delete(checkId)
          const errorMessage = data.error ?? 'チェック処理が失敗しました'
          console.error('Check failed via SSE error event:', errorMessage)
          setChecks(prev => prev.map(check => 
            check.id === checkId 
              ? { 
                  ...check, 
                  status: 'failed',
                  statusMessage: `エラー: ${errorMessage}` 
                }
              : check
          ))
          setErrorMessage(`エラー: ${errorMessage}`)
          setState('failed')
          safeCloseEventSource(eventSource)
        } catch (error) {
          console.error('Failed to parse error event:', error)
        }
      })

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setChecks(prev => prev.map(check => 
          check.id === checkId 
            ? { 
                ...check, 
                statusMessage: 'SSE接続に失敗しました。ポーリングで結果の取得を継続します…' 
              }
            : check
        ))
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
      setErrorMessage(`エラー: ${errorMessage}`)
      setState('failed')
    }
  }
  
  // キャンセル機能（TextCheckerパターン）
  const handleCancel = async (checkId: string) => {
    cleanupControllers(checkId)

    setChecks(prev => prev.map(check => 
      check.id === checkId 
        ? { 
            ...check, 
            status: 'cancelled',
            statusMessage: 'チェックがキャンセルされました' 
          }
        : check
    ))

    // サーバーサイドでのキャンセル処理（修正：正しいサーバーIDを使用）
    try {
      const serverCheckId = serverCheckIds.current.get(checkId)
      if (serverCheckId) {
        await fetch(`/api/checks/${serverCheckId}/cancel`, {
          method: 'POST',
          credentials: 'same-origin'
        })
        serverCheckIds.current.delete(checkId)
      } else {
        console.warn('Server check ID not found for client check ID:', checkId)
      }
    } catch (error) {
      console.error('Failed to cancel on server:', error)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-4">画像から薬機法チェック</h1>
        <p className="text-gray-600 text-center">
          画像をアップロードしてOCRで文字を抽出し、薬機法違反をチェック・修正します
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 入力エリア */}
        <div className="space-y-4">
          {/* ドラッグ&ドロップゾーン */}
          <div className="space-y-4">
            <label className="block text-sm font-medium mb-2">
              画像ファイル（JPEG/PNG/WebP、最大10MB）
            </label>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : file 
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
              data-testid="dropzone"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  document.getElementById('file-input')?.click()
                }
              }}
              aria-label="画像ファイルのアップロード"
            >
              <input
                id="file-input"
                type="file"
                accept={ACCEPT_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => onSelectFiles(e.target.files)}
                aria-describedby="file-input-help"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                {file ? (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <div className="text-sm font-medium text-green-700">ファイルが選択されました</div>
                    <div className="text-xs text-green-600">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
                    </div>
                  </>
                ) : isDragOver ? (
                  <>
                    <UploadCloud className="w-12 h-12 text-blue-500 animate-bounce" />
                    <div className="text-sm font-medium text-blue-700">ファイルをドロップしてください</div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-12 h-12 text-gray-400" />
                    <div className="text-sm text-gray-700 font-medium">ここにドラッグ&ドロップ、またはクリックして選択</div>
                    <div className="text-xs text-gray-500" id="file-input-help">
                      対応形式: JPEG, PNG, WebP（最大10MB）
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* ファイルが選択されている場合のコントロール */}
            {file && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFile}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  クリア
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={!file || state === 'uploading' || state === 'processing' || !organizationStatus.canPerformCheck}
                  className="min-w-[120px]"
                  data-testid="check-button"
                >
                  {state === 'uploading' || state === 'processing' || state === 'starting_check' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      実行中...
                    </>
                  ) : (
                    'チェック開始'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* プレビューエリア */}
          {previewUrl && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1" />
                    画像プレビュー
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="relative rounded-lg overflow-hidden border bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={previewUrl} 
                    alt="アップロード画像のプレビュー" 
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 進行状況表示 */}
          {(state === 'uploading' || state === 'starting_check') && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>アップロード進行状況</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm" data-testid="error-message">{errorMessage}</p>
                  {errorMessage.includes('使用制限') || errorMessage.includes('Usage limit') ? (
                    <div className="mt-2" data-testid="upgrade-prompt">
                      <p className="text-sm text-gray-600">
                        プランをアップグレードするか、管理者にお問い合わせください。
                      </p>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => {
                        setErrorMessage(null)
                        if (file) handleStart()
                      }}
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      data-testid="retry-button"
                    >
                      再試行
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* キュー状態表示（TextCheckerパターン） */}
          {(queueStatus.processingCount > 0 || queueStatus.queueLength > 0 || !organizationStatus.canPerformCheck) && (
            <div className="mt-4 p-3 border rounded-md">
              <div className="text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">システム状態</span>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${
                      systemStatus.serverLoad.processing === 'full' 
                        ? 'bg-red-500 animate-pulse' 
                        : systemStatus.serverLoad.queue === 'busy'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}></div>
                    <span className="text-xs text-gray-600">
                      {systemStatus.serverLoad.processing === 'full' ? '満負荷' : 
                       systemStatus.serverLoad.queue === 'busy' ? '処理中' : '利用可能'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-600">処理スロット</div>
                    <div className="font-medium">
                      {queueStatus.processingCount}/{queueStatus.maxConcurrent}
                      <span className="text-gray-500 ml-1">
                        (利用可能: {queueStatus.availableSlots})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">キュー待機</div>
                    <div className="font-medium">{queueStatus.queueLength}件</div>
                  </div>
                </div>
                
                {(queueStatus.processingStats.text > 0 || queueStatus.processingStats.image > 0) && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">処理中のチェック</div>
                    <div className="flex space-x-4 text-xs">
                      {queueStatus.processingStats.text > 0 && (
                        <div>テキスト: {queueStatus.processingStats.text}件</div>
                      )}
                      {queueStatus.processingStats.image > 0 && (
                        <div>画像: {queueStatus.processingStats.image}件</div>
                      )}
                    </div>
                  </div>
                )}
                
                {!organizationStatus.canPerformCheck && (
                  <div className="mt-2 pt-2 border-t border-red-200 bg-red-50 -m-3 p-3 rounded-b-md">
                    <div className="text-xs text-red-700">
                      月間制限に達しました: {organizationStatus.currentMonthChecks}/{organizationStatus.monthlyLimit}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                        {check.originalText}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex items-center space-x-1 flex-1">
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
                          {check.status === 'cancelled' && (
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-500" data-testid="status-message">{check.statusMessage}</span>
                            {check.queuePosition && check.status === 'queued' && (
                              <div className="text-xs text-blue-600 mt-0.5">
                                キュー位置: {check.queuePosition}番目
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-gray-400">
                        チェック #{check.timestamp}
                      </div>
                      {(check.status === 'queued' || check.status === 'processing') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancel(check.id)
                          }}
                          className="text-xs px-2 py-1 h-6"
                          data-testid="cancel-button"
                        >
                          キャンセル
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 結果エリア */}
        <div className="space-y-4">
          {hasActiveCheck ? (
            <div data-testid="results-section">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">チェック結果</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activeCheck?.result && handleCopy(activeCheck.result.modified_text)}
                    data-testid="copy-button"
                  >
                    <Copy className="w-4 h-4" />
                    コピー
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid="download-button"
                    onClick={() => {
                      if (activeCheck?.result) {
                        const content = generateImageCheckReport(activeCheck.result)
                        const blob = new Blob([content], { type: 'text/plain' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `image-check-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
                        link.style.display = 'none'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        URL.revokeObjectURL(url)
                      }
                    }}
                  >
                    <Download className="w-4 h-4" />
                    ダウンロード
                  </Button>
                </div>
              </div>

              {/* コピー成功メッセージ */}
              {copySuccess && (
                <div className={`mt-4 p-3 border rounded-md ${
                  copySuccess.includes('手動') 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-green-50 border-green-200'
                }`} data-testid={copySuccess.includes('手動') ? 'copy-fallback' : 'copy-success'}>
                  <p className={`text-sm ${
                    copySuccess.includes('手動') ? 'text-yellow-800' : 'text-green-800'
                  }`}>{copySuccess}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OCR抽出テキスト */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">OCR抽出テキスト</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activeCheck?.result && handleCopy(activeCheck.result.original_text)}
                      data-testid="copy-original-button"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="border rounded p-4 min-h-[300px] bg-gray-50 text-base leading-relaxed font-medium text-gray-900 whitespace-pre-wrap">
                    {activeCheck.result!.original_text || 'テキストが抽出されませんでした'}
                  </div>
                </div>
                
                {/* 修正されたテキスト */}
                <div>
                  <h3 className="font-medium mb-2">修正されたテキスト</h3>
                  <div className="border rounded p-4 min-h-[300px] bg-green-50 text-base leading-relaxed font-medium text-gray-900 whitespace-pre-wrap">
                    {activeCheck.result!.modified_text || '修正テキストがありません'}
                  </div>
                </div>
              </div>
              
              {/* 違反詳細 */}
              {activeCheck.result!.violations.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-4">検出された違反 ({activeCheck.result!.violations.length}件)</h3>
                  <div className="space-y-3">
                    {activeCheck.result!.violations.map((violation, index) => (
                      <div key={violation.id || index} className="border rounded p-4 bg-red-50">
                        <div className="font-medium text-red-800 mb-2">
                          違反箇所 {index + 1}
                        </div>
                        <div className="text-sm text-red-700 mb-1">
                          位置: {violation.startPos} - {violation.endPos}
                        </div>
                        <div className="text-sm mb-2">
                          <strong>該当テキスト:</strong> &quot;{activeCheck.result!.original_text.slice(violation.startPos, violation.endPos)}&quot;
                        </div>
                        <div className="text-sm">
                          <strong>理由:</strong> {violation.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded p-8 text-center text-gray-500">
              画像を選択し、「チェック開始」ボタンを押してください
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

/**
 * OCR精度向上のための画像前処理
 * 指定サイズへのリサイズとJPEG変換を行う
 * @param inputFile 元の画像ファイル
 * @param maxDimension 最大寸法（幅または高さ）
 * @param quality JPEG品質（0-1）
 * @returns 処理済みのファイル
 */
async function preprocessForOcr(inputFile: File, maxDimension: number, quality: number): Promise<File> {
  const imgUrl = URL.createObjectURL(inputFile)
  try {
    const img = await loadImage(imgUrl)
    const { width, height } = img
    // アスペクト比を維持してリサイズ倍率を計算
    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return inputFile
    // 高品質なスムージングを有効化
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, targetW, targetH)

    // JPEG形式でブロブを生成
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob) return inputFile
    const processedName = inputFile.name.replace(/\.[^.]+$/, '') + '-processed.jpg'
    return new File([blob], processedName, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

/**
 * 画像のロード用ヘルパー関数
 * @param url 画像URL
 * @returns Promise<HTMLImageElement>
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = url
  })
}