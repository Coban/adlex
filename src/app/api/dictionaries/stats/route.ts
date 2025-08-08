import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(_request: NextRequest) {
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

    const orgId = userProfile.organization_id

    // Totals by category (clientでも計算可能だがAPIでも返す)
    const { data: dicts, error: dictErr } = await supabase
      .from("dictionaries")
      .select("id, category, phrase")
      .eq("organization_id", orgId)

    if (dictErr) {
      console.error("辞書取得エラー:", dictErr)
      return NextResponse.json({ error: "統計取得に失敗しました" }, { status: 500 })
    }

    const total = dicts?.length ?? 0
    const ng = dicts?.filter(d => d.category === 'NG').length ?? 0
    const allow = total - ng

    // 使用頻度（最近30日）の上位10件: violationsを集計
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: checks, error: checksErr } = await supabase
      .from("checks")
      .select("id")
      .eq("organization_id", orgId)
      .gte("created_at", sinceIso)

    if (checksErr) {
      console.error("チェック取得エラー:", checksErr)
      return NextResponse.json({ error: "統計取得に失敗しました" }, { status: 500 })
    }

    const checkIds = (checks ?? []).map(c => c.id)
    interface TopUsedItem { dictionary_id: number; count: number; phrase: string }
    let topUsed: TopUsedItem[] = []

    if (checkIds.length > 0) {
      // violationsは型定義外のためanyでクエリ
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: violations, error: vioErr } = await (supabase as any)
        .from('violations')
        .select('dictionary_id, check_id')
        .in('check_id', checkIds)

      if (vioErr) {
        console.error('違反取得エラー:', vioErr)
      } else {
        const counts = new Map<number, number>()
        for (const v of violations ?? []) {
          if (!v.dictionary_id) continue
          counts.set(v.dictionary_id, (counts.get(v.dictionary_id) ?? 0) + 1)
        }
        const entries = Array.from(counts.entries())
          .map(([dictionary_id, count]) => ({ dictionary_id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)

        if (entries.length > 0) {
          const dictIds = entries.map(e => e.dictionary_id)
          const { data: phraseRows } = await supabase
            .from('dictionaries')
            .select('id, phrase')
            .in('id', dictIds)
          const idToPhrase = new Map<number, string>()
          for (const r of (phraseRows ?? [])) idToPhrase.set(r.id, r.phrase)
          topUsed = entries.map(e => ({ ...e, phrase: idToPhrase.get(e.dictionary_id) ?? '' }))
        }
      }
    }

    return NextResponse.json({
      totals: { total, ng, allow },
      topUsed,
      since: sinceIso,
    })
  } catch (e) {
    console.error("辞書統計APIエラー:", e)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}


