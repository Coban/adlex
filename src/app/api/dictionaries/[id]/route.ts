import { NextRequest, NextResponse } from "next/server";

import { getRepositories } from "@/lib/repositories";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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
    const userProfile = await repositories.users.findById(user.id);
    if (!userProfile || !userProfile.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const dictionary = await repositories.dictionaries.findByIdAndOrganization(dictionaryId, userProfile.organization_id);
    if (!dictionary) {
      return NextResponse.json({ error: "辞書項目が見つかりません" }, {
        status: 404,
      });
    }

    return NextResponse.json({ dictionary });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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
    const userProfile = await repositories.users.findById(user.id);
    if (!userProfile || !userProfile.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    // 管理者権限チェック
    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, {
        status: 403,
      });
    }

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
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

    // Use repository method for update with embedding
    const response = await repositories.dictionaries.updateWithEmbedding(dictionaryId, userProfile.organization_id, {
      phrase,
      category,
      notes,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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
    const userProfile = await repositories.users.findById(user.id);
    if (!userProfile || !userProfile.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    // 管理者権限チェック
    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, {
        status: 403,
      });
    }

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    // 辞書項目が組織に属しているか確認
    const existingDictionary = await repositories.dictionaries.findByIdAndOrganization(dictionaryId, userProfile.organization_id);
    if (!existingDictionary) {
      return NextResponse.json({ error: "辞書項目が見つかりません" }, {
        status: 404,
      });
    }

    const success = await repositories.dictionaries.delete(dictionaryId);
    if (!success) {
      return NextResponse.json({ error: "辞書項目の削除に失敗しました" }, {
        status: 500,
      });
    }

    return NextResponse.json({ message: "辞書項目を削除しました" });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}
