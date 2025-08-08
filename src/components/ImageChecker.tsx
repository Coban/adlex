'use client'

import { Loader2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

type UploadState = 'idle' | 'ready' | 'validating' | 'uploading' | 'uploaded' | 'starting_check' | 'processing' | 'completed' | 'failed'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ImageChecker() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('画像を選択してください')
  const [extractedText, setExtractedText] = useState<string>('')
  const [modifiedText, setModifiedText] = useState<string>('')
  // DBのチェックID（SSEに利用）
  // const [dbCheckId, setDbCheckId] = useState<number | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (sseRef.current) sseRef.current.close()
    }
  }, [previewUrl])

  const onSelectFiles = (files: FileList | null) => {
    setError(null)
    if (!files || files.length === 0) return
    const f = files[0]
    if (!ACCEPT_TYPES.includes(f.type)) {
      setError('対応していないファイル形式です（JPEG/PNG/WebP）')
      return
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError('ファイルサイズが10MBを超えています')
      return
    }
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setState('ready')
    setStatusMessage('アップロード可能です')
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const dt = e.dataTransfer
    if (!dt?.files?.length) return
    onSelectFiles(dt.files)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleStart = async () => {
    try {
      setError(null)
      if (!user) throw new Error('認証が必要です。サインインしてください。')
      if (!file) throw new Error('ファイルが選択されていません')
      setState('validating')
      setStatusMessage('ファイルを検証中...')

      // Upload via API
      setState('uploading')
      setStatusMessage('アップロード中...')
      const form = new FormData()
      form.append('image', file)

      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      const uploadRes = await fetch('/api/images/upload', { method: 'POST', body: form, headers })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error ?? `アップロードエラー: ${uploadRes.status}`)
      }
      const uploadData = await uploadRes.json() as { signedUrl: string }
      if (!uploadData?.signedUrl) throw new Error('署名付きURLの取得に失敗しました')

      // Start check with input_type=image
      setState('starting_check')
      setStatusMessage('画像チェックを開始しています...')
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
        const err = await checksRes.json().catch(() => ({}))
        throw new Error(err.error ?? `チェック開始エラー: ${checksRes.status}`)
      }
      const checkData = await checksRes.json() as { id: number }
      if (!checkData?.id) throw new Error('チェックIDの取得に失敗しました')
      // dbCheckIdは現在のUIでは未使用

      // Connect SSE for progress & result
      setState('processing')
      setStatusMessage('OCRおよび薬機法チェックを実行中...')
      const es = new EventSource(`/api/checks/${checkData.id}/stream`)
      sseRef.current = es
      es.onmessage = async (event) => {
        try {
          if (event.data.startsWith(': heartbeat')) return
          const data = JSON.parse(event.data) as {
            status: 'pending' | 'processing' | 'completed' | 'failed'
            ocr_status?: 'pending' | 'processing' | 'completed' | 'failed'
            extracted_text?: string | null
            modified_text?: string | null
            error?: string | null
          }
          if (data.status === 'processing') {
            setStatusMessage(data.ocr_status === 'processing' ? 'OCR実行中...' : '分析中...')
          }
          if (data.status === 'completed') {
            setState('completed')
            setStatusMessage('チェック完了')
            setExtractedText(String(data.extracted_text ?? ''))
            setModifiedText(String(data.modified_text ?? ''))
            es.close()
          }
          if (data.status === 'failed') {
            setState('failed')
            setError(String(data.error ?? '処理に失敗しました'))
            es.close()
          }
        } catch {
          setState('failed')
          setError('結果の受信に失敗しました')
          es.close()
        }
      }
      es.onerror = () => {
        setState('failed')
        setError('サーバー接続エラー')
        es.close()
      }
    } catch (e) {
      setState('failed')
      setError(e instanceof Error ? e.message : '予期しないエラーが発生しました')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">画像から薬機法チェック</h1>
        <p className="text-gray-600">画像をアップロードしてOCR→薬機法チェックを実行します</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 画像プレビュー & ドロップゾーン */}
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
            onClick={() => document.getElementById('file-input')?.click()}
            data-testid="dropzone"
          >
            <input
              id="file-input"
              type="file"
              accept={ACCEPT_TYPES.join(',')}
              className="hidden"
              onChange={(e) => onSelectFiles(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <UploadCloud className="w-8 h-8 text-gray-500" />
              <div className="text-sm text-gray-600">ここにドラッグ&ドロップ、またはクリックして選択</div>
              <div className="text-xs text-gray-500">対応形式: JPEG, PNG, WebP（最大10MB）</div>
            </div>
          </div>

          {previewUrl && (
            <div>
              <div className="text-sm text-gray-700 mb-2">プレビュー</div>
              {/* next/imageは外部S3等の最適化で制約もあるため、当面はimgを使用 */}
              <img src={previewUrl} alt="preview" className="w-full rounded border" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">{error}</div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">{statusMessage}</div>
            <Button onClick={handleStart} disabled={!file || state === 'uploading' || state === 'processing'}>
              {state === 'uploading' || state === 'processing' || state === 'starting_check' ? (
                <span className="inline-flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 実行中...</span>
              ) : 'チェック開始'}
            </Button>
          </div>
        </div>

        {/* 抽出テキスト */}
        <div className="space-y-2">
          <div className="font-medium">抽出テキスト（OCR）</div>
          <Textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} className="min-h-[400px] bg-gray-50" placeholder="OCR結果がここに表示されます" />
        </div>

        {/* 修正後テキスト */}
        <div className="space-y-2">
          <div className="font-medium">修正されたテキスト</div>
          <div className="border rounded p-4 min-h-[400px] bg-green-50 whitespace-pre-wrap text-gray-900">{modifiedText}</div>
        </div>
      </div>
    </div>
  )
}


