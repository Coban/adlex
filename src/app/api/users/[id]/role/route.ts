import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: userId } = await params;
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    const { role } = body;

    if (!["admin", "user"].includes(role)) {
      return NextResponse.json(
        { error: "無効なロールです" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 現在のユーザーを取得
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    // 現在のユーザー情報を取得
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (userError || !currentUser) {
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

    // 自分自身の権限は変更できないようにする
    if (user.id === userId) {
      return NextResponse.json(
        { error: "自分自身の権限は変更できません" },
        { status: 400 },
      );
    }

    // 対象ユーザーが同じ組織に所属しているかチェック
    const { data: targetUser, error: targetUserError } = await supabase
      .from("users")
      .select("organization_id, role, email")
      .eq("id", userId)
      .single();
    

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: "対象ユーザーが見つかりません" },
        { status: 404 },
      );
    }

    if (targetUser.organization_id !== currentUser.organization_id) {
      return NextResponse.json(
        { error: "同じ組織のユーザーのみ権限変更できます" },
        { status: 403 },
      );
    }

    // ユーザーの権限を更新
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, email, role, updated_at");
    

    if (updateError) {
      return NextResponse.json(
        { error: "ユーザー権限の変更に失敗しました" },
        { status: 500 },
      );
    }

    if (!updatedUser || updatedUser.length === 0) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "ユーザー権限が更新されました",
      user: updatedUser[0],
    });
  } catch {
    return NextResponse.json(
      { error: "ユーザー権限の変更に失敗しました" },
      { status: 500 },
    );
  }
}
