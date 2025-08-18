import { NextResponse } from "next/server";

import { getRepositories } from '@/lib/repositories'
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 現在のユーザーを取得
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    // Get repositories
    const repositories = await getRepositories(supabase);

    // 現在のユーザー情報を取得（管理者権限をチェック）
    const currentUser = await repositories.users.findById(user.id);
    if (!currentUser) {
      return NextResponse.json(
        { error: "ユーザー情報の取得に失敗しました" },
        { status: 400 },
      );
    }

    // 管理者権限をチェック
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 },
      );
    }

    // 組織IDを確認
    if (!currentUser.organization_id) {
      return NextResponse.json(
        { error: "組織に所属していません" },
        { status: 400 },
      );
    }

    // 組織に所属するユーザー一覧を取得
    const users = await repositories.users.findByOrganizationId(
      currentUser.organization_id,
      { orderBy: [{ field: 'created_at', direction: 'desc' }] }
    );

    return NextResponse.json({
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
