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

    // 同一phraseの重複検出
    const { data: rows, error } = await supabase
      .from('dictionaries')
      .select('id, phrase, category, notes, created_at')
      .eq('organization_id', userProfile.organization_id)
      .order('phrase', { ascending: true })

    if (error) {
      console.error('重複検出エラー:', error)
      return NextResponse.json({ error: '重複検出に失敗しました' }, { status: 500 })
    }

    const map = new Map<string, typeof rows>()
    for (const r of rows ?? []) {
      const key = (r.phrase ?? '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const duplicates = Array.from(map.entries())
      .filter(([, list]) => list.length > 1)
      .map(([phrase, list]) => ({ phrase, items: list }))

    return NextResponse.json({ duplicates })
  } catch (e) {
    console.error('重複検出APIエラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}


