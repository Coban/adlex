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

/**
 * 画像アップロード・OCR・薬機法チェックを行うコンポーネント
 * 画像の前処理、OCR実行、結果表示までを一貫して処理
 */
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

  /**
   * ファイル選択時の処理
   * ファイル形式・サイズ検証とプレビューURL生成
   */
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

  /**
   * 画像チェック処理の開始
   * 画像前処理 → アップロード → チェック実行 → SSE結果受信
   */
  const handleStart = async () => {
    try {
      setError(null)
      if (!user) throw new Error('認証が必要です。サインインしてください。')
      if (!file) throw new Error('ファイルが選択されていません')
      setState('validating')
      setStatusMessage('ファイルを検証中...')

      // API経由でアップロード
      setState('uploading')
      setStatusMessage('アップロード中...')
      // クライアントサイドの前処理: 最大2000pxにリサイズ、JPEG変換
      const processedFile = await preprocessForOcr(file, 2000, 0.9)
      const form = new FormData()
      form.append('image', processedFile)

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

      // input_type=imageでチェック開始
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

      // 進捗と結果のためのSSE接続
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = url
  })
}


