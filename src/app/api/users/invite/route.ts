import { randomBytes } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, role = "user" } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスが必要です" },
        { status: 400 },
      );
    }

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

    // 組織IDを確認
    if (!currentUser.organization_id) {
      return NextResponse.json(
        { error: "組織に所属していません" },
        { status: 400 },
      );
    }

    // 既に同じメールアドレスのユーザーが存在するかチェック
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 },
      );
    }

    // 既存の未承認の招待があるかチェック
    const { data: existingInvitation } = await supabase
      .from("user_invitations")
      .select("id")
      .eq("email", email)
      .eq("organization_id", currentUser.organization_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: "このメールアドレスには既に招待が送信されています" },
        { status: 400 },
      );
    }

    // 招待トークンを生成
    const token = randomBytes(32).toString("hex");

    // 招待レコードを作成
    const { data: invitation, error: inviteError } = await supabase
      .from("user_invitations")
      .insert({
        organization_id: currentUser.organization_id,
        email,
        role,
        token,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invitation creation error:", inviteError);
      return NextResponse.json(
        { error: "招待の作成に失敗しました" },
        { status: 500 },
      );
    }

    // 招待メールを送信（実装は簡略化）
    const invitationUrl = `${
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    }/auth/invitation?token=${token}`;

    // TODO: 実際のメール送信サービスを統合
    console.log(`招待メール送信:
      宛先: ${email}
      招待URL: ${invitationUrl}
      ロール: ${role}
    `);

    return NextResponse.json({
      message: "招待を送信しました",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        invitation_url: invitationUrl,
      },
    });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      { error: "招待の送信に失敗しました" },
      { status: 500 },
    );
  }
}
