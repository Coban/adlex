import { NextRequest, NextResponse } from "next/server";

import { createEmbedding } from "@/lib/ai-client";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database.types";

type DictionaryInsert = Database["public"]["Tables"]["dictionaries"]["Insert"];
type DictionaryRow = Database["public"]["Tables"]["dictionaries"]["Row"];

// API レスポンス型を定義
interface DictionaryCreateResponse {
  dictionary: DictionaryRow;
  warning?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ユーザーの認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザープロファイルと組織情報を取得
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    // 検索クエリパラメータを取得
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("search") ?? "";
    const category = url.searchParams.get("category") ?? "ALL";

    // 基本クエリ
    let query = supabase
      .from("dictionaries")
      .select("*")
      .eq("organization_id", userProfile.organization_id)
      .order("created_at", { ascending: false });

    // カテゴリフィルター
    if (category !== "ALL" && (category === "NG" || category === "ALLOW")) {
      query = query.eq("category", category);
    }

    // 検索フィルター
    if (searchTerm) {
      query = query.or(
        `phrase.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`,
      );
    }

    const { data: dictionaries, error } = await query;

    if (error) {
      console.error("辞書取得エラー:", error);
      return NextResponse.json({ error: "辞書の取得に失敗しました" }, {
        status: 500,
      });
    }

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

    // ユーザープロファイルと組織情報を取得
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.organization_id) {
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

    // Embedding生成
    let vector: number[] | null = null;
    try {
      vector = await createEmbedding(phrase.trim());
    } catch (embeddingError) {
      console.warn("Embedding生成に失敗しました:", embeddingError);
      // Embedding生成に失敗してもアイテム作成は続行
    }

    const newDictionary: DictionaryInsert = {
      organization_id: userProfile.organization_id,
      phrase: phrase.trim(),
      category,
      notes: notes?.trim() ?? null,
      vector: vector ? JSON.stringify(vector) : null,
    };

    const { data: dictionary, error } = await supabase
      .from("dictionaries")
      .insert(newDictionary)
      .select()
      .single();

    if (error) {
      console.error("辞書作成エラー:", error);
      return NextResponse.json({ error: "辞書項目の作成に失敗しました" }, {
        status: 500,
      });
    }

    // Embedding生成に失敗した場合は警告を含める
    const response: DictionaryCreateResponse = { dictionary };
    if (!vector) {
      response.warning =
        "辞書項目は作成されましたが、Embedding生成に失敗しました。後で手動で再生成することができます。";
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}
