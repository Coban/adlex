import { NextRequest, NextResponse } from "next/server";

import {
  validateGetUsersQuery,
  validateInviteUserRequest,
  createSuccessResponse,
  createErrorResponse
} from '@/core/dtos/users'
import { getRepositories } from '@/core/ports'
import { GetUsersUseCase } from '@/core/usecases/users/getUsers'
import { InviteUserUseCase } from '@/core/usecases/users/inviteUser'
import { createClient } from "@/infra/supabase/serverClient";

/**
 * ユーザー一覧取得API（リファクタリング済み）
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
      role: url.searchParams.get("role") ?? 'ALL',
      organizationId: url.searchParams.get("organizationId") ? parseInt(url.searchParams.get("organizationId")!) : undefined
    }

    const validationResult = validateGetUsersQuery(queryData)
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
    const getUsersUseCase = new GetUsersUseCase(repositories)
    const result = await getUsersUseCase.execute({
      currentUserId: user.id,
      search: validationResult.data.search,
      role: validationResult.data.role,
      organizationId: validationResult.data.organizationId
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
    console.error("ユーザー一覧取得API エラー:", error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    );
  }
}

/**
 * ユーザー招待API（リファクタリング済み）
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
    const validationResult = validateInviteUserRequest(body)
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
    const inviteUserUseCase = new InviteUserUseCase(repositories)
    const result = await inviteUserUseCase.execute({
      currentUserId: user.id,
      email: validationResult.data.email,
      role: validationResult.data.role
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
    console.error("ユーザー招待API エラー:", error);
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
