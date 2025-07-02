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

    // 組織に所属するユーザー一覧を取得
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, role, created_at, updated_at")
      .eq("organization_id", currentUser.organization_id)
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Users fetch error:", usersError);
      return NextResponse.json(
        { error: "ユーザー一覧の取得に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      users: users || [],
    });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
