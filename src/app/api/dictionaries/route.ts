import { NextRequest, NextResponse } from "next/server";

import {
  validateGetDictionariesQuery,
  validateCreateDictionaryRequest,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/dictionaries'
import { getRepositories } from "@/core/ports";
import { CreateDictionaryUseCase } from '@/core/usecases/dictionaries/createDictionary'
import { GetDictionariesUseCase } from '@/core/usecases/dictionaries/getDictionaries'
import { createClient } from "@/infra/supabase/serverClient";

/**
 * 辞書一覧取得API（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', '認証が必要です'),
        { status: 401 }
      );
    }

    // クエリパラメータの取得とバリデーション
    const url = new URL(request.url);
    const queryData = {
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? 'ALL'
    }

    const validationResult = validateGetDictionariesQuery(queryData)
    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          validationResult.error.details
        ),
        { status: 400 }
      );
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase);

    // ユースケース実行
    const getDictionariesUseCase = new GetDictionariesUseCase(repositories)
    const result = await getDictionariesUseCase.execute({
      userId: user.id,
      search: validationResult.data.search,
      category: validationResult.data.category
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      );
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data)
    );

  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    );
  }
}

/**
 * 辞書作成API（リファクタリング済み）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', '認証が必要です'),
        { status: 401 }
      );
    }

    // リクエストボディの取得と基本バリデーション
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body'),
        { status: 400 }
      );
    }

    // DTOバリデーション
    const validationResult = validateCreateDictionaryRequest(body)
    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse(
          validationResult.error.code,
          validationResult.error.message,
          validationResult.error.details
        ),
        { status: 400 }
      );
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase);

    // ユーザーの組織ID取得（簡略化）
    const userData = await repositories.users.findById(user.id)
    if (!userData?.organization_id) {
      return NextResponse.json(
        createErrorResponse('AUTHORIZATION_ERROR', 'User not in organization'),
        { status: 404 }
      );
    }

    // ユースケース実行
    const createDictionaryUseCase = new CreateDictionaryUseCase(repositories)
    const result = await createDictionaryUseCase.execute({
      userId: user.id,
      organizationId: userData.organization_id,
      phrase: validationResult.data.phrase,
      category: validationResult.data.category,
      reasoning: validationResult.data.reasoning
    })

    // 結果の処理
    if (!result.success) {
      const statusCode = getStatusCodeFromError(result.error.code)
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      );
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data),
      { status: 201 }
    );

  } catch (error) {
    console.error("辞書作成API エラー:", error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    );
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