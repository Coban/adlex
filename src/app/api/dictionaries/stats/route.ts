import { NextRequest, NextResponse } from "next/server"

import { getRepositories } from "@/lib/repositories"
import { createClient } from "@/lib/supabase/server"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // Get repositories
    const repositories = await getRepositories(supabase)

    const userProfile = await repositories.users.findById(user.id)
    if (!userProfile?.organization_id) {
      return NextResponse.json({ error: "ユーザープロファイルが見つかりません" }, { status: 404 })
    }

    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
    }

    const orgId = userProfile.organization_id

    // Totals by category (clientでも計算可能だがAPIでも返す)
    const dicts = await repositories.dictionaries.findByOrganizationId(orgId)
    
    const total = dicts.length
    const ng = dicts.filter(d => d.category === 'NG').length
    const allow = total - ng

    // 使用頻度（最近30日）の上位10件: violationsを集計
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const checks = await repositories.checks.findMany({
      where: {
        organization_id: orgId,
        created_at: sinceIso
      }
    })

    const checkIds = checks.map(c => c.id)
    interface TopUsedItem { dictionary_id: number; count: number; phrase: string }
    let topUsed: TopUsedItem[] = []

    if (checkIds.length > 0) {
      // Get all violations for these checks
      const allViolations = await Promise.all(
        checkIds.map(checkId => repositories.violations.findByCheckId(checkId))
      )
      const violations = allViolations.flat()

      const counts = new Map<number, number>()
      for (const v of violations) {
        if (!v.dictionary_id) continue
        counts.set(v.dictionary_id, (counts.get(v.dictionary_id) ?? 0) + 1)
      }
      const entries = Array.from(counts.entries())
        .map(([dictionary_id, count]) => ({ dictionary_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      if (entries.length > 0) {
        const dictIds = entries.map(e => e.dictionary_id)
        const phraseRows = await Promise.all(
          dictIds.map(id => repositories.dictionaries.findById(id))
        )
        const idToPhrase = new Map<number, string>()
        for (const r of phraseRows) {
          if (r) idToPhrase.set(r.id, r.phrase)
        }
        topUsed = entries.map(e => ({ ...e, phrase: idToPhrase.get(e.dictionary_id) ?? '' }))
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


