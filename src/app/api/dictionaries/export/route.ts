import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

function escapeCsvField(value: string | null | undefined): string {
  const text = (value ?? "").replace(/\r\n|\r|\n/g, "\n")
  if (text.includes("\n") || text.includes(",") || text.includes('"')) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // 組織と権限確認
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

    const { data: dictionaries, error } = await supabase
      .from("dictionaries")
      .select("phrase, category, notes")
      .eq("organization_id", userProfile.organization_id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("辞書エクスポート取得エラー:", error)
      return NextResponse.json({ error: "辞書の取得に失敗しました" }, { status: 500 })
    }

    const header = ["phrase", "category", "notes"].join(",")
    const rows = (dictionaries ?? []).map((d) => [
      escapeCsvField(d.phrase),
      escapeCsvField(d.category),
      escapeCsvField(d.notes ?? null)
    ].join(","))

    // Excel互換のためBOM付きUTF-8
    const csv = "\ufeff" + [header, ...rows].join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"dictionaries.csv\"",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("CSVエクスポートAPIエラー:", e)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}


