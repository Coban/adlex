import { NextRequest, NextResponse } from "next/server";

import { createEmbedding } from "@/lib/ai-client";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database.types";

type DictionaryUpdate = Database["public"]["Tables"]["dictionaries"]["Update"];
type DictionaryRow = Database["public"]["Tables"]["dictionaries"]["Row"];

// API レスポンス型を定義
interface DictionaryUpdateResponse {
  dictionary: DictionaryRow;
  warning?: string;
}

// Dictionary更新用の型（vectorを含む）
interface DictionaryUpdateWithVector extends DictionaryUpdate {
  vector?: string;
}

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

    // ユーザープロファイルと組織情報を取得
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile?.organization_id) {
      return NextResponse.json({
        error: "ユーザープロファイルが見つかりません",
      }, { status: 404 });
    }

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const { data: dictionary, error } = await supabase
      .from("dictionaries")
      .select("*")
      .eq("id", dictionaryId)
      .eq("organization_id", userProfile.organization_id)
      .single();

    if (error || !dictionary) {
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

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const body = await request.json();
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

    // 辞書項目が組織に属しているか確認
    const { data: existingDictionary, error: existingError } = await supabase
      .from("dictionaries")
      .select("id, phrase")
      .eq("id", dictionaryId)
      .eq("organization_id", userProfile.organization_id)
      .single();

    if (existingError || !existingDictionary) {
      return NextResponse.json({ error: "辞書項目が見つかりません" }, {
        status: 404,
      });
    }

    // フレーズが変更された場合のみembedding再生成
    let vector: number[] | string | null = null;
    const phraseChanged = existingDictionary.phrase !== phrase.trim();

    if (phraseChanged) {
      try {
        const newVector = await createEmbedding(phrase.trim());
        vector = JSON.stringify(newVector);
      } catch (embeddingError) {
        console.warn("Embedding再生成に失敗しました:", embeddingError);
        // Embedding生成に失敗してもアイテム更新は続行
      }
    }

    const updates: DictionaryUpdateWithVector = {
      phrase: phrase.trim(),
      category,
      notes: notes?.trim() ?? null,
      updated_at: new Date().toISOString(),
    };

    // フレーズが変更された場合のみvectorを更新
    if (phraseChanged && vector !== null) {
      updates.vector = vector;
    }

    const { data: dictionary, error } = await supabase
      .from("dictionaries")
      .update(updates)
      .eq("id", dictionaryId)
      .select()
      .single();

    if (error) {
      console.error("辞書更新エラー:", error);
      return NextResponse.json({ error: "辞書項目の更新に失敗しました" }, {
        status: 500,
      });
    }

    // Embedding生成に失敗した場合は警告を含める
    const response: DictionaryUpdateResponse = { dictionary };
    if (phraseChanged && vector === null) {
      response.warning =
        "辞書項目は更新されましたが、Embedding再生成に失敗しました。後で手動で再生成することができます。";
    }

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

    const dictionaryId = parseInt(id);
    if (isNaN(dictionaryId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    // 辞書項目が組織に属しているか確認
    const { data: existingDictionary, error: existingError } = await supabase
      .from("dictionaries")
      .select("id")
      .eq("id", dictionaryId)
      .eq("organization_id", userProfile.organization_id)
      .single();

    if (existingError || !existingDictionary) {
      return NextResponse.json({ error: "辞書項目が見つかりません" }, {
        status: 404,
      });
    }

    const { error } = await supabase
      .from("dictionaries")
      .delete()
      .eq("id", dictionaryId);

    if (error) {
      console.error("辞書削除エラー:", error);
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
