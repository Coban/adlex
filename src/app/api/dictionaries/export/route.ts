import { NextRequest, NextResponse } from "next/server"

import { getRepositories } from "@/lib/repositories"
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

    // Get repositories
    const repositories = await getRepositories(supabase)

    // 組織と権限確認
    const userProfile = await repositories.users.findById(user.id)
    if (!userProfile?.organization_id) {
      return NextResponse.json({ error: "ユーザープロファイルが見つかりません" }, { status: 404 })
    }

    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
    }

    const dictionaries = await repositories.dictionaries.findByOrganizationId(
      userProfile.organization_id,
      {
        orderBy: [{ field: 'created_at', direction: 'asc' }]
      }
    )

    const header = ["phrase", "category", "notes"].join(",")
    const rows = dictionaries.map((d) => [
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


