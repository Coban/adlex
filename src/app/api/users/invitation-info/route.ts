import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "トークンが必要です" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 有効な招待情報を取得
    const { data: invitation, error: invitationError } = await supabase
      .from("user_invitations")
      .select(`
        email,
        role,
        organization_id,
        organizations (
          name
        )
      `)
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

    // TypeScriptのため、organizationsの型を確認
    const organization = invitation.organizations as { name: string } | null;

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      organizationName: organization?.name || "不明な組織",
    });
  } catch (error) {
    console.error("Get invitation info error:", error);
    return NextResponse.json(
      { error: "招待情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
