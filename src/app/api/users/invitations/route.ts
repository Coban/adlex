import { NextResponse } from "next/server";

import { getRepositories } from "@/core/ports";
import { GetInvitationsUseCase } from "@/core/usecases/users/getInvitations";
import { createClient } from "@/infra/supabase/serverClient";

export async function GET() {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new GetInvitationsUseCase(repositories);

    // UseCase実行
    const result = await useCase.execute({
      currentUserId: user.id
    });

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : 500;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({
      invitations: result.data.invitations
    });
  } catch (error) {
    console.error("Get invitations error:", error);
    return NextResponse.json(
      { error: "招待リストの取得に失敗しました" },
      { status: 500 },
    );
  }
}
