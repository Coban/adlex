import { NextRequest, NextResponse } from "next/server";

import {
  validateRefreshEmbeddingsBody,
  validateEmbeddingStatsQuery,
  createRefreshSuccessResponse,
  createStatsSuccessResponse,
  createJobProgressSuccessResponse,
  createEmbeddingErrorResponse
} from '@/core/dtos/dictionary-embeddings'
import { getRepositories } from '@/core/ports'
import { GetEmbeddingStatsUseCase } from '@/core/usecases/dictionaries/getEmbeddingStats'
import { RefreshEmbeddingsUseCase } from '@/core/usecases/dictionaries/refreshEmbeddings'
import { createClient } from "@/infra/supabase/serverClient";

/**
 * 辞書埋め込みリフレッシュAPI（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        createEmbeddingErrorResponse('AUTH_ERROR', '認証が必要です'),
        { status: 401 }
      );
    }

    // リクエストボディの解析とバリデーション
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return NextResponse.json(
        createEmbeddingErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // DTOバリデーション
    const validationResult = validateRefreshEmbeddingsBody(body ?? {})
    if (!validationResult.success) {
      return NextResponse.json(
        createEmbeddingErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          JSON.stringify(validationResult.error.details)
        ),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const refreshEmbeddingsUseCase = new RefreshEmbeddingsUseCase(repositories)
    const result = await refreshEmbeddingsUseCase.execute({
      userId: user.id,
      dictionaryIds: validationResult.data.dictionaryIds
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createEmbeddingErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス
    return NextResponse.json(createRefreshSuccessResponse(result.data))

  } catch (error) {
    console.error("Embedding再生成API エラー:", error);
    return NextResponse.json(
      createEmbeddingErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    );
  }
}

/**
 * 埋め込み統計取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 * - ?jobId=... がある場合: 非同期ジョブの進捗を返す
 * - パラメータがない場合: 組織の辞書項目のembedding状況を返す
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        createEmbeddingErrorResponse('AUTH_ERROR', '認証が必要です'),
        { status: 401 }
      );
    }

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())

    // DTOバリデーション
    const validationResult = validateEmbeddingStatsQuery(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        createEmbeddingErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          JSON.stringify(validationResult.error.details)
        ),
        { status: 400 }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ユースケース実行
    const getStatsUseCase = new GetEmbeddingStatsUseCase(repositories)
    const result = await getStatsUseCase.execute({
      userId: user.id,
      jobId: validationResult.data.jobId
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createEmbeddingErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      )
    }

    // 成功レスポンス（ジョブ進捗か統計かを判定）
    if ('id' in result.data && 'status' in result.data) {
      // ジョブ進捗レスポンス
      return NextResponse.json(createJobProgressSuccessResponse(result.data))
    } else {
      // 統計レスポンス
      return NextResponse.json(createStatsSuccessResponse(result.data))
    }

  } catch (error) {
    console.error("Embedding統計情報API エラー:", error);
    return NextResponse.json(
      createEmbeddingErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    );
  }
}

/**
 * エラーコードからHTTPステータスコードを取得するヘルパー
 */
function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'AUTH_ERROR':
      return 400
    case 'FORBIDDEN_ERROR':
      return 403
    case 'NOT_FOUND_ERROR':
      return 404
    case 'INTERNAL_ERROR':
      return 500
    default:
      return 500
  }
}
