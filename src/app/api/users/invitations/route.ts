import { NextResponse } from "next/server";

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

    // 組織IDを確認
    if (!currentUser.organization_id) {
      return NextResponse.json(
        { error: "組織に所属していません" },
        { status: 400 },
      );
    }

    // 招待リストを取得
    const { data: invitations, error: invitationsError } = await supabase
      .from("user_invitations")
      .select("*")
      .eq("organization_id", currentUser.organization_id)
      .order("created_at", { ascending: false });

    if (invitationsError) {
      console.error("Invitations fetch error:", invitationsError);
      return NextResponse.json(
        { error: "招待リストの取得に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      invitations: invitations || [],
    });
  } catch (error) {
    console.error("Get invitations error:", error);
    return NextResponse.json(
      { error: "招待リストの取得に失敗しました" },
      { status: 500 },
    );
  }
}
