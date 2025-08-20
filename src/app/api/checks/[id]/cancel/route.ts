import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/core/ports'
import { CancelCheckUseCase } from '@/core/usecases/checks/cancelCheck'
import { createClient } from '@/infra/supabase/serverClient'

export async function POST(
  _: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const repositories = await getRepositories(supabase)
    const useCase = new CancelCheckUseCase(repositories)
    const result = await useCase.execute({ checkId: parseInt(params.id), currentUserId: user.id })

    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
        : result.code === 'AUTHORIZATION_ERROR' ? 403
        : result.code === 'NOT_FOUND_ERROR' ? 404
        : result.code === 'VALIDATION_ERROR' ? 400
        : 500

      return NextResponse.json(
        { error: result.error },
        { status: statusCode }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Check cancel error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}