import { NextRequest, NextResponse } from "next/server"

import { getRepositories } from "@/core/ports"
import { GetDictionaryDuplicatesUseCase } from "@/core/usecases/dictionaries/getDictionaryDuplicates"
import { createClient } from "@/infra/supabase/serverClient"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const repositories = await getRepositories(supabase)
    const useCase = new GetDictionaryDuplicatesUseCase(repositories)
    
    const result = await useCase.execute({
      currentUserId: user.id
    })

    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401 
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(result.data)
  } catch (e) {
    console.error('重複検出APIエラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}


