import fs from 'node:fs'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const checkId = parseInt(id)

    if (isNaN(checkId)) {
      return NextResponse.json({ error: 'Invalid check ID' }, { status: 400 })
    }

    // 認証
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ユーザー/組織情報
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData?.organization_id) {
      return NextResponse.json({ error: 'User not found or not in organization' }, { status: 404 })
    }

    // チェック詳細取得（違反含む）
    const { data: check, error: checkError } = await supabase
      .from('checks')
      .select(`
        id,
        original_text,
        modified_text,
        status,
        created_at,
        completed_at,
        user_id,
        organization_id,
        input_type,
        image_url,
        extracted_text,
        users!inner(email),
        violations(
          id,
          start_pos,
          end_pos,
          reason,
          dictionary_id,
          dictionaries(phrase, category)
        )
      `)
      .eq('id', checkId)
      .eq('organization_id', userData.organization_id)
      .is('deleted_at', null)
      .single()

    if (checkError || !check) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 })
    }

    // アクセス権限
    if (userData.role === 'user' && check.user_id !== userData.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // PDF生成（Buffer）
    const pdfBuffer = await generatePdfBuffer(check)

    const filename = `check_${check.id}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

interface DictionaryRow {
  phrase?: string | null
  category?: 'NG' | 'ALLOW' | null
}

interface ViolationRow {
  id: number
  start_pos: number
  end_pos: number
  reason: string
  dictionaries?: DictionaryRow | null
}

interface CheckRow {
  id: number
  original_text: string | null
  modified_text: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | null
  created_at: string | null
  completed_at: string | null
  user_id: string
  organization_id: number
  input_type: 'text' | 'image' | null
  image_url: string | null
  extracted_text: string | null
  users?: { email?: string | null } | null
  violations?: ViolationRow[] | null
}

async function generatePdfBuffer(check: CheckRow): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `AdLex Check #${check.id}` } })

  // 日本語フォントの登録（存在する場合のみ）。
  // プロジェクトに `public/fonts/NotoSansJP-Regular.ttf` を配置すると日本語表示が安定します。
  try {
    const fontPath = `${process.cwd()}/public/fonts/NotoSansJP-Regular.ttf`
    if (fs.existsSync(fontPath)) {
      doc.registerFont('NotoSansJP', fontPath)
      doc.font('NotoSansJP')
    }
  } catch {
    // フォント未配置時はデフォルトフォント（日本語は環境依存）
  }

  const chunks: Buffer[] = []
  const resultPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', (err) => reject(err))
  })

  // ヘッダー
  doc.fontSize(18).text('薬機法チェックレポート', { align: 'left' })
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor('#666').text(`チェックID: #${check.id}`)
  if (check.users?.email) doc.text(`ユーザー: ${check.users.email}`)
  doc.text(`作成日時: ${formatDate(check.created_at)}`)
  if (check.completed_at) doc.text(`完了日時: ${formatDate(check.completed_at)}`)
  doc.text(`ステータス: ${statusLabel(check.status)}`)
  if (check.input_type === 'image') {
    doc.text(`入力タイプ: 画像（OCR連携）`)
    if (check.image_url) doc.text(`画像URL: ${check.image_url}`, { link: check.image_url, underline: true })
  } else {
    doc.text(`入力タイプ: テキスト`)
  }
  doc.moveDown()
  doc.fillColor('#000')

  // 違反一覧の準備
  const violations: ViolationRow[] = Array.isArray(check.violations) ? check.violations : []

  // 原文（ハイライト付き）
  doc.fontSize(14).text('原文', { underline: true })
  doc.moveDown(0.3)
  
  // ハイライト付きテキストを描画
  const originalText = String(check.original_text ?? '')
  renderTextWithHighlights(doc, originalText, violations)
  doc.moveDown()

  // 画像→OCRの抽出テキスト（該当時）
  if (check.input_type === 'image' && check.extracted_text) {
    doc.fontSize(14).text('抽出テキスト（OCR）', { underline: true })
    doc.moveDown(0.3)
    
    // OCRテキストにもハイライトを適用
    const extractedText = String(check.extracted_text ?? '')
    renderTextWithHighlights(doc, extractedText, violations)
    doc.moveDown()
  }

  // 修正文
  doc.fontSize(14).text('修正文', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(10).text(String(check.modified_text ?? '（修正文は生成されていません）'), { width: 500 })
  doc.moveDown()

  // 違反一覧
  doc.fontSize(14).text(`検出された違反（${violations.length}件）`, { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(10)
  if (violations.length === 0) {
    doc.text('違反は検出されませんでした。')
  } else {
    violations.forEach((v: ViolationRow, idx: number) => {
      doc.fillColor('#000').text(`違反 #${idx + 1}`)
      doc.fillColor('#666').text(`位置: ${v.start_pos}-${v.end_pos}`)
      if (v.dictionaries?.phrase) {
        const cat = v.dictionaries?.category ? `（${v.dictionaries.category}）` : ''
        doc.text(`辞書語句: ${v.dictionaries.phrase}${cat}`)
      }
      doc.fillColor('#000').text(`理由: ${v.reason}`)
      // 原文抜粋
      const original = String(check.original_text ?? '')
      const start = Math.max(0, Math.min(v.start_pos ?? 0, original.length))
      const end = Math.max(start, Math.min(v.end_pos ?? start, original.length))
      const snippet = original.substring(start, end)
      if (snippet) {
        doc.fillColor('#c00').text(`該当箇所: "${snippet}"`)
      }
      doc.moveDown(0.6)
    })
  }

  doc.end()
  return resultPromise
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return String(iso)
  }
}

function renderTextWithHighlights(doc: PDFKit.PDFDocument, text: string, violations: ViolationRow[]) {
  if (!violations || violations.length === 0) {
    doc.fontSize(10).fillColor('#000').text(text, { width: 500 })
    return
  }

  // 違反箇所を位置順でソート
  const sortedViolations = violations
    .filter(v => v.start_pos !== null && v.end_pos !== null && v.start_pos < text.length)
    .sort((a, b) => a.start_pos - b.start_pos)

  if (sortedViolations.length === 0) {
    doc.fontSize(10).fillColor('#000').text(text, { width: 500 })
    return
  }

  doc.fontSize(10)
  let currentPos = 0

  // 違反箇所ごとにテキストを分割して描画
  for (const violation of sortedViolations) {
    const start = Math.max(0, Math.min(violation.start_pos, text.length))
    const end = Math.max(start, Math.min(violation.end_pos, text.length))

    // 前の通常テキストを描画
    if (currentPos < start) {
      const beforeText = text.substring(currentPos, start)
      drawNormalText(doc, beforeText, true)
    }

    // 違反箇所を赤色でハイライト
    const violationText = text.substring(start, end)
    if (violationText) {
      drawHighlightedText(doc, violationText)
    }

    currentPos = end
  }

  // 残りのテキストを描画
  if (currentPos < text.length) {
    const remainingText = text.substring(currentPos)
    doc.fillColor('#000').text(remainingText)
  } else {
    doc.text('') // 改行を確保
  }
}

/**
 * 通常のテキストを描画
 */
function drawNormalText(doc: PDFKit.PDFDocument, text: string, continued = false) {
  doc.font('Helvetica').fontSize(10).fillColor('#000').text(text, { continued })
}

/**
 * ハイライトされたテキストを描画
 */
function drawHighlightedText(doc: PDFKit.PDFDocument, text: string) {
  // フォント設定を先に行い、文字幅を正確に計算
  doc.font('Helvetica').fontSize(10).fillColor('#dc2626')
  
  // 背景の赤い矩形を描画
  doc.rect(doc.x, doc.y - 2, doc.widthOfString(text), doc.currentLineHeight())
     .fillOpacity(0.2)
     .fill()
     .fillOpacity(1)
  
  // テキストを描画
  doc.fillColor('#dc2626').text(text, { continued: true })
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'pending':
      return '待機中'
    case 'processing':
      return '処理中'
    case 'completed':
      return '完了'
    case 'failed':
      return 'エラー'
    default:
      return String(status ?? '')
  }
}
