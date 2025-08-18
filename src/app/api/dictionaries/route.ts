import { NextRequest, NextResponse } from "next/server";

import { getRepositories } from "@/lib/repositories";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Get repositories
    const repositories = await getRepositories(supabase);

    // ユーザープロファイルと組織情報を取得
    const userData = await repositories.users.findById(user.id);
    if (!userData || !userData.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    // 検索クエリパラメータを取得
    const searchTerm = url.searchParams.get("search") ?? "";
    const category = url.searchParams.get("category") ?? "ALL";

    // Use repository search method
    const dictionaries = await repositories.dictionaries.searchDictionaries({
      organizationId: userData.organization_id,
      search: searchTerm || undefined,
      category: category as any,
    });

    return NextResponse.json({ dictionaries });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Get repositories
    const repositories = await getRepositories(supabase);

    // ユーザープロファイルと組織情報を取得
    const userData = await repositories.users.findById(user.id);
    if (!userData || !userData.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    // 管理者権限チェック
    if (userData.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, {
        status: 403,
      });
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    const { phrase, category, notes } = body;

    // バリデーション
    if (!phrase?.trim()) {
      return NextResponse.json({ error: "フレーズは必須です" }, {
        status: 400,
      });
    }

    if (!["NG", "ALLOW"].includes(category)) {
      return NextResponse.json({ error: "無効なカテゴリです" }, {
        status: 400,
      });
    }

    // Use repository method for creation with embedding
    const response = await repositories.dictionaries.createWithEmbedding({
      organization_id: userData.organization_id,
      phrase,
      category,
      notes,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}
