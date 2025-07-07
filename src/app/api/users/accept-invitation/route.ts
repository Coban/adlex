import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "トークンとパスワードが必要です" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上である必要があります" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 有効な招待を確認
    const { data: invitation, error: invitationError } = await supabase
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "無効または期限切れの招待リンクです" },
        { status: 400 },
      );
    }

    // 既にユーザーが存在するかチェック
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", invitation.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 },
      );
    }

    // Supabase Authでユーザーを作成
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
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
      // ユーザー作成をロールバック（簡略化）
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
