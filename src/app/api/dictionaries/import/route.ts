import { NextRequest, NextResponse } from "next/server"

import { createEmbedding } from "@/lib/ai-client"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/types/database.types"

type DictionaryInsert = Database["public"]["Tables"]["dictionaries"]["Insert"]

function parseCsv(text: string): { rows: { phrase: string; category: "NG" | "ALLOW"; notes: string | null }[]; errors: string[] } {
  const errors: string[] = []
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(l => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], errors: ["CSVが空です"] }

  // 期待ヘッダ: phrase,category,notes（大小無視）
  const first = lines[0].replace(/^\ufeff/, "")
  const header = first.split(",").map(h => h.trim().toLowerCase())
  const idxPhrase = header.indexOf("phrase")
  const idxCategory = header.indexOf("category")
  const idxNotes = header.indexOf("notes")
  if (idxPhrase === -1 || idxCategory === -1) {
    errors.push("ヘッダにphrase,categoryが必要です")
    return { rows: [], errors }
  }

  function unescapeCsv(field: string): string {
    const f = field.trim()
    if (f.startsWith('"') && f.endsWith('"')) {
      return f.slice(1, -1).replace(/""/g, '"')
    }
    return f
  }

  const rows: { phrase: string; category: "NG" | "ALLOW"; notes: string | null }[] = []
  const seenInFile = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    // 簡易CSV分割（ダブルクオート対応）
    const cols: string[] = []
    let cur = ""
    let inQuotes = false
    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c]
      if (inQuotes) {
        if (ch === '"') {
          if (raw[c + 1] === '"') { cur += '"'; c++ } else { inQuotes = false }
        } else {
          cur += ch
        }
      } else {
        if (ch === '"') { inQuotes = true }
        else if (ch === ',') { cols.push(cur); cur = "" }
        else { cur += ch }
      }
    }
    cols.push(cur)

    const phrase = unescapeCsv(cols[idxPhrase] ?? "").trim()
    const categoryRaw = (unescapeCsv(cols[idxCategory] ?? "").trim().toUpperCase()) as "NG" | "ALLOW"
    const n = idxNotes >= 0 ? unescapeCsv(cols[idxNotes] ?? "").trim() : null
    const notes = n === "" ? null : n

    if (!phrase) {
      errors.push(`${i + 1}行目: phraseが空です`)
      continue
    }
    if (categoryRaw !== "NG" && categoryRaw !== "ALLOW") {
      errors.push(`${i + 1}行目: categoryはNG/ALLOWのみ有効です`)
      continue
    }

    if (seenInFile.has(phrase)) {
      errors.push(`${i + 1}行目: 同一ファイル内で重複するphraseのためスキップ (${phrase})`)
      continue
    }
    seenInFile.add(phrase)
    rows.push({ phrase, category: categoryRaw, notes })
  }

  return { rows, errors }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      return NextResponse.json({ error: "ユーザープロファイルが見つかりません" }, { status: 404 })
    }

    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
    }

    // Bodyはtext/csv想定（ファイルアップロードUIから渡す）
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("text/csv")) {
      // フォームからのFileの場合はmultipartに対応するのは将来対応
      const text = await request.text().catch(() => "")
      if (!text) {
        return NextResponse.json({ error: "CSV本文が必要です" }, { status: 400 })
      }
      const { rows, errors } = parseCsv(text)
      if (rows.length === 0) {
        return NextResponse.json({ error: "有効な行がありません", details: errors }, { status: 400 })
      }

      // 既存レコード取得（重複回避: phrase単位、同一組織内）
      const { data: existing, error: fetchErr } = await supabase
        .from("dictionaries")
        .select("phrase")
        .eq("organization_id", userProfile.organization_id)
      if (fetchErr) {
        console.error("既存辞書取得エラー:", fetchErr)
        return NextResponse.json({ error: "インポートに失敗しました" }, { status: 500 })
      }
      const existingSet = new Set((existing ?? []).map(e => e.phrase.trim()))

      const inserts: DictionaryInsert[] = []
      const skipped: { phrase: string; reason: string }[] = []

      for (const r of rows) {
        if (existingSet.has(r.phrase)) {
          skipped.push({ phrase: r.phrase, reason: "既に存在するためスキップ" })
          continue
        }
        inserts.push({
          organization_id: userProfile.organization_id,
          phrase: r.phrase,
          category: r.category,
          notes: r.notes,
        })
      }

      // まずDBに挿入（vectorは後続で生成）。PostgRESTの制約で最大件数があるのでチャンク分割
      const chunkSize = 500
      let inserted = 0
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize)
        if (chunk.length === 0) continue
        const { error: insertErr } = await supabase
          .from("dictionaries")
          .insert(chunk)
        if (insertErr) {
          console.error("挿入エラー:", insertErr)
          return NextResponse.json({ error: "辞書の挿入に失敗しました" }, { status: 500 })
        }
        inserted += chunk.length
      }

      // Embeddingは同期で生成すると重いので、ここでは必要最低限: 先頭100件のみ同期生成、残りは手動/別APIで再生成
      const toEmbed = rows
        .filter(r => !existingSet.has(r.phrase))
        .slice(0, 100)

      let embedded = 0
      for (const r of toEmbed) {
        try {
          const vec = await createEmbedding(r.phrase)
          await supabase
            .from("dictionaries")
            .update({ vector: JSON.stringify(vec) })
            .eq("organization_id", userProfile.organization_id)
            .eq("phrase", r.phrase)
          embedded++
        } catch (e) {
          // ベクトル生成失敗は無視（後で一括再生成可能）
          console.warn("Embedding生成失敗:", r.phrase, e)
        }
      }

      return NextResponse.json({
        inserted,
        skipped,
        embedded,
        warnings: errors,
      }, { status: 201 })
    }

    // multipart/form-data は将来対応
    return NextResponse.json({ error: "multipart/form-dataは未サポートです。text/csvで送信してください。" }, { status: 415 })
  } catch (e) {
    console.error("CSVインポートAPIエラー:", e)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}


