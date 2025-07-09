import { NextRequest, NextResponse } from "next/server";

import { createEmbedding } from "@/lib/ai-client";
import { createClient } from "@/lib/supabase/server";

interface RefreshResponse {
  message: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  failures?: Array<{
    id: number;
    phrase: string;
    error: string;
  }>;
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

    // リクエストボディから対象IDを取得（省略可能）
    const body = await request.json().catch(() => ({}));
    const { dictionaryIds } = body;

    // 対象となる辞書項目を取得
    let query = supabase
      .from("dictionaries")
      .select("id, phrase")
      .eq("organization_id", userProfile.organization_id);

    // 特定のIDが指定されている場合はフィルタリング
    if (
      dictionaryIds && Array.isArray(dictionaryIds) && dictionaryIds.length > 0
    ) {
      query = query.in("id", dictionaryIds);
    }

    const { data: dictionaries, error: fetchError } = await query;

    if (fetchError) {
      console.error("辞書項目取得エラー:", fetchError);
      return NextResponse.json({ error: "辞書項目の取得に失敗しました" }, {
        status: 500,
      });
    }

    if (!dictionaries || dictionaries.length === 0) {
      return NextResponse.json({
        message: "対象となる辞書項目が見つかりません",
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
      });
    }

    // 辞書項目のembedding再生成を開始

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ id: number; phrase: string; error: string }> = [];

    // 各辞書項目のembeddingを順次生成
    for (const dictionary of dictionaries) {
      try {
        // 辞書項目のembedding生成中

        const vector = await createEmbedding(dictionary.phrase);

        // データベースを更新
        const { error: updateError } = await supabase
          .from("dictionaries")
          .update({
            vector: JSON.stringify(vector),
            updated_at: new Date().toISOString(),
          })
          .eq("id", dictionary.id);

        if (updateError) {
          throw new Error(`データベース更新エラー: ${updateError.message}`);
        }

        successCount++;
                  // 辞書項目のembedding生成完了
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error
          ? error.message
          : "不明なエラー";
        failures.push({
          id: dictionary.id,
          phrase: dictionary.phrase,
          error: errorMessage,
        });
        console.error(
          `辞書項目 ${dictionary.id} のembedding生成に失敗:`,
          errorMessage,
        );
      }
    }

    const response: RefreshResponse = {
      message:
        `Embedding再生成が完了しました。成功: ${successCount}件、失敗: ${failureCount}件`,
      totalProcessed: dictionaries.length,
      successCount,
      failureCount,
    };

    if (failures.length > 0) {
      response.failures = failures;
    }

          // Embedding再生成処理完了

    return NextResponse.json(response);
  } catch (error) {
    console.error("Embedding再生成API エラー:", error);
    return NextResponse.json({
      error: "サーバーエラーが発生しました",
      details: error instanceof Error ? error.message : "不明なエラー",
    }, {
      status: 500,
    });
  }
}

// GETメソッドで組織の辞書項目のembedding状況を確認
export async function GET() {
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

    // 組織の辞書項目のembedding状況を取得
    const { data: stats, error: statsError } = await supabase
      .from("dictionaries")
      .select("id, phrase, vector")
      .eq("organization_id", userProfile.organization_id);

    if (statsError) {
      console.error("統計情報取得エラー:", statsError);
      return NextResponse.json({ error: "統計情報の取得に失敗しました" }, {
        status: 500,
      });
    }

    const totalItems = stats?.length || 0;
    const itemsWithEmbedding = stats?.filter((item) =>
      item.vector !== null
    ).length || 0;
    const itemsWithoutEmbedding = totalItems - itemsWithEmbedding;

    return NextResponse.json({
      organizationId: userProfile.organization_id,
      totalItems,
      itemsWithEmbedding,
      itemsWithoutEmbedding,
      embeddingCoverageRate: totalItems > 0
        ? Math.round((itemsWithEmbedding / totalItems) * 100)
        : 0,
    });
  } catch (error) {
    console.error("Embedding統計情報API エラー:", error);
    return NextResponse.json({
      error: "サーバーエラーが発生しました",
      details: error instanceof Error ? error.message : "不明なエラー",
    }, {
      status: 500,
    });
  }
}
