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
    } catch (formDataError) {
      console.error('フォームデータ解析エラー:', { 
        error: formDataError,
        contentType: request.headers.get('content-type'),
        userId: user.id
      })
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', '無効なフォームデータです', { 
          contentType: request.headers.get('content-type'),
          errorType: formDataError instanceof Error ? formDataError.name : 'UnknownError'
        }),
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
      
      // デバッグ用の詳細ログ出力（本番環境では詳細は非表示）
      if (result.error.details) {
        console.error('画像アップロードエラー詳細:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          userId: user.id
        })
      }
      
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message, result.error.details),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data)
    )

  } catch (error) {
    console.error("画像アップロードAPI 予期しないエラー:", {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      requestUrl: request.url,
      requestMethod: request.method,
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        timestamp: new Date().toISOString()
      }),
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
    case 'RATE_LIMIT_ERROR':
      return 429
    case 'QUOTA_EXCEEDED_ERROR':
      return 413
    case 'INTERNAL_ERROR':
      return 500
    default:
      console.warn('未知のエラーコード:', errorCode)
      return 500
  }
}


