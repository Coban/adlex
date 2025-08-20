import { NextRequest, NextResponse } from 'next/server'

import { 
  validateCreateCheckRequest,
  createSuccessResponse,
  createErrorResponse 
} from '@/core/dtos/checks'
import { getRepositories } from '@/core/ports'
import { CreateCheckUseCase } from '@/core/usecases/checks/createCheck'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * 薬機法チェック処理を開始するAPIエンドポイント（リファクタリング済み）
 * DTOバリデーション → ユースケース呼び出し → レスポンス変換の薄い層
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Authorizationヘッダーでのフォールバック認証（必要に応じて）
    if (!user && !authError) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        try {
          const { createClient: createServiceClient } = await import('@supabase/supabase-js')
          const supabaseService = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: { user: tokenUser }, error: tokenError } = await supabaseService.auth.getUser(token)
          if (tokenUser && !tokenError) {
            // Note: この実装はより複雑な認証ハンドリングが必要かもしれません
          }
        } catch {
          // トークン検証失敗時は通常の認証エラー処理に進む
        }
      }
    }

    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', 'Unauthorized'),
        { status: 401 }
      )
    }

    // リクエストボディの取得と基本バリデーション
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // 旧形式から新形式への変換（下位互換性のため）
    const requestData = {
      text: body.text ?? '',
      inputType: body.input_type ?? body.inputType ?? 'text',
      fileName: body.fileName
    }

    // DTOバリデーション
    const validationResult = validateCreateCheckRequest(requestData)
    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          validationResult.error.details
        ),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユーザーの組織ID取得（簡略化）
    const userData = await repositories.users.findById(user.id)
    if (!userData?.organization_id) {
      return NextResponse.json(
        createErrorResponse('AUTHORIZATION_ERROR', 'User not in organization'),
        { status: 404 }
      )
    }

    // ユースケース実行
    const createCheckUseCase = new CreateCheckUseCase(repositories)
    const result = await createCheckUseCase.execute({
      userId: user.id,
      organizationId: userData.organization_id,
      originalText: validationResult.data.text,
      inputType: validationResult.data.inputType,
      fileName: validationResult.data.fileName
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse({
        checkId: result.data.checkId,
        status: result.data.status,
        message: result.data.message
      })
    )

  } catch (error) {
    console.error('Error in checks API:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * エラーコードからHTTPステータスコードを取得するヘルパー
 */
function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'AUTHENTICATION_ERROR':
      return 401
    case 'AUTHORIZATION_ERROR':
      return 403
    case 'VALIDATION_ERROR':
      return 400
    case 'NOT_FOUND_ERROR':
      return 404
    case 'CONFLICT_ERROR':
      return 409
    case 'USAGE_LIMIT_EXCEEDED':
      return 429
    case 'QUEUE_ERROR':
      return 503
    case 'REPOSITORY_ERROR':
      return 500
    default:
      return 500
  }
}