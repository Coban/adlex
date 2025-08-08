import { NextRequest, NextResponse } from "next/server";

import { embeddingQueue } from "@/lib/embedding-queue";
import { createClient } from "@/lib/supabase/server";

// (unused type removed)

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
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    const { dictionaryIds } = body ?? {};

    // 非同期ジョブを開始
    const job = await embeddingQueue.enqueueOrganization(
      userProfile.organization_id,
      Array.isArray(dictionaryIds) && dictionaryIds.length > 0 ? dictionaryIds : undefined
    )

    return NextResponse.json({
      message: "Embedding再生成ジョブを開始しました",
      jobId: job.id,
      total: job.total,
      status: job.status,
    })
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

// GETメソッド
// - ?jobId=... がある場合: 非同期ジョブの進捗を返す
// - パラメータがない場合: 組織の辞書項目のembedding状況を返す
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

    // 管理者権限チェック
    if (userProfile.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, {
        status: 403,
      });
    }

    // ジョブ進捗の問い合わせ
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    if (jobId) {
      const job = embeddingQueue.getJob(jobId)
      if (!job) {
        return NextResponse.json({ error: '指定されたジョブが見つかりません' }, { status: 404 })
      }
      return NextResponse.json(job)
    }

    // 組織の辞書項目のembedding統計を取得
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
