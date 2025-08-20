import { NextRequest, NextResponse } from "next/server";

import { createErrorResponse } from '@/core/dtos/users';
import { getRepositories } from "@/core/ports";
import { InviteUserUseCase } from "@/core/usecases/users/inviteUser";
import { createClient } from "@/infra/supabase/serverClient";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('AUTHENTICATION_ERROR', '認証が必要です'),
        { status: 401 },
      );
    }

    // リクエストボディ解析
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid JSON in request body'),
        { status: 400 }
      );
    }
    const { email, role = "user" } = body;

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new InviteUserUseCase(repositories);

    // UseCase実行
    const result = await useCase.execute({
      currentUserId: user.id,
      email,
      role
    });

    // 結果処理
    if (!result.success) {
      const statusCode = result.error.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.error.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.error.code === 'VALIDATION_ERROR' ? 400
                        : result.error.code === 'CONFLICT_ERROR' ? 409
                        : 500;
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: statusCode }
      );
    }

    // 招待URL生成（暫定的にフロントエンド用）
    const invitationUrl = `${
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    }/auth/invitation?token=placeholder`;

    return NextResponse.json({
      message: result.data.message,
      invitation: {
        id: result.data.invitationId,
        email: result.data.email,
        role: result.data.role,
        invitation_url: invitationUrl,
      },
    });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', '招待の送信に失敗しました'),
      { status: 500 },
    );
  }
}
