import { NextRequest, NextResponse } from "next/server"

import { getRepositories } from "@/lib/repositories"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/types/database.types"

type DictionaryUpdate = Database["public"]["Tables"]["dictionaries"]["Update"]

export async function PUT(request: NextRequest) {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const payload = body as { updates: { id: number; patch: Pick<DictionaryUpdate, 'phrase' | 'category' | 'notes'> }[] }
    if (!payload?.updates || !Array.isArray(payload.updates)) {
      return NextResponse.json({ error: 'updates配列が必要です' }, { status: 400 })
    }

    // 1件ずつ更新（組織チェックを含めた安全な更新）
    let success = 0
    let failure = 0
    for (const u of payload.updates) {
      if (!u?.id || !u.patch) { failure++; continue }
      
      try {
        // 組織に属する辞書アイテムか検証
        const existingItem = await repositories.dictionaries.findByIdAndOrganization(u.id, userProfile.organization_id)
        if (!existingItem) {
          failure++
          continue
        }

        const updates: DictionaryUpdate = {
          ...u.patch,
          updated_at: new Date().toISOString(),
        }
        
        const updated = await repositories.dictionaries.update(u.id, updates)
        if (updated) { success++ } else { failure++ }
      } catch (error) {
        console.error(`Error updating dictionary item ${u.id}:`, error)
        failure++
      }
    }

    return NextResponse.json({ success, failure })
  } catch (e) {
    console.error('一括更新APIエラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}


