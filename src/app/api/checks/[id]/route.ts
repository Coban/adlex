import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/core/ports'
import { DeleteCheckUseCase } from '@/core/usecases/checks/deleteCheck'
import { GetCheckDetailUseCase } from '@/core/usecases/checks/getCheckDetail'
import { createClient } from '@/infra/supabase/serverClient'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params
    const checkId = parseInt(resolvedParams.id)
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase)
    const useCase = new GetCheckDetailUseCase(repositories)

    // UseCase実行
    const result = await useCase.execute({
      checkId,
      currentUserId: user.id
    })

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : result.code === 'VALIDATION_ERROR' ? 400
                        : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ check: result.data.check })

  } catch (error) {
    console.error('Check detail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params
    const checkId = parseInt(resolvedParams.id)
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase)
    const useCase = new DeleteCheckUseCase(repositories)

    // UseCase実行
    const result = await useCase.execute({
      checkId,
      currentUserId: user.id
    })

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : result.code === 'VALIDATION_ERROR' ? 400
                        : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ message: result.data.message })

  } catch (error) {
    console.error('Check deletion API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
