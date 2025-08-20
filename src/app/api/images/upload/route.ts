import { NextRequest, NextResponse } from 'next/server'

import {
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/images'
import { getRepositories } from '@/core/ports'
import { UploadImageUseCase } from '@/core/usecases/images/uploadImage'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * 画像アップロードAPI（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', '認証が必要です'),
        { status: 401 }
      )
    }

    // フォームデータの取得とファイルの基本バリデーション
    let formData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', '無効なフォームデータです'),
        { status: 400 }
      )
    }

    const file = formData.get('image')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', '画像ファイルが必要です'),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const uploadImageUseCase = new UploadImageUseCase(repositories)
    const result = await uploadImageUseCase.execute({
      currentUserId: user.id,
      file: file
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
      createSuccessResponse(result.data)
    )

  } catch (error) {
    console.error("画像アップロードAPI エラー:", error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
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
    case 'REPOSITORY_ERROR':
      return 500
    default:
      return 500
  }
}


