import { NextRequest, NextResponse } from "next/server";

import { getRepositories } from "@/core/ports";
import { AcceptInvitationUseCase } from "@/core/usecases/users/acceptInvitation";
import { createClient } from "@/infra/supabase/serverClient";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // リクエストボディ解析
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { token, password } = body;

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new AcceptInvitationUseCase(repositories);

    // UseCase実行（事前バリデーションのみ）
    const validationResult = await useCase.execute({
      token,
      password
    });

    // バリデーション結果処理
    if (!validationResult.success) {
      const statusCode = validationResult.code === 'VALIDATION_ERROR' ? 400
                        : validationResult.code === 'NOT_FOUND_ERROR' ? 404
                        : validationResult.code === 'CONFLICT_ERROR' ? 409
                        : 500;
      return NextResponse.json({ error: validationResult.error }, { status: statusCode });
    }

    // 招待情報取得（UseCase実行後は有効な招待が存在することが確認済み）
    const invitation = await repositories.userInvitations.findByToken(token);

    // Supabase Authでユーザーを作成
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invitation!.email,
      password,
      options: {
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
        }/auth/callback`,
        data: {
          invitationToken: token,
        },
      },
    });

    if (authError || !authData.user) {
      console.error("Auth signup error:", authError);
      return NextResponse.json(
        { error: "アカウントの作成に失敗しました" },
        { status: 500 },
      );
    }

    // データベース側では handle_new_user トリガーによって
    // ユーザーレコードが作成されるが、招待の場合は
    // accept_invitation 関数を呼び出して組織に割り当てる
    const { error: acceptError } = await supabase.rpc("accept_invitation", {
      invitation_token: token,
      new_user_id: authData.user.id,
    });

    if (acceptError) {
      console.error("Accept invitation error:", acceptError);
      return NextResponse.json(
        { error: "招待の承認に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message:
        "アカウントが作成されました。メールを確認してアカウントを有効化してください。",
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "招待の承認に失敗しました" },
      { status: 500 },
    );
  }
}
