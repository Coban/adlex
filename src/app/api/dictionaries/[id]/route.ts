import { NextRequest, NextResponse } from "next/server";

import { getRepositories } from "@/core/ports";
import { DeleteDictionaryUseCase } from "@/core/usecases/dictionaries/deleteDictionary";
import { GetDictionaryUseCase } from "@/core/usecases/dictionaries/getDictionary";
import { UpdateDictionaryUseCase } from "@/core/usecases/dictionaries/updateDictionary";
import { createClient } from "@/infra/supabase/serverClient";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const dictionaryId = parseInt(id);
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new GetDictionaryUseCase(repositories);

    // UseCase実行
    const result = await useCase.execute({
      dictionaryId,
      currentUserId: user.id
    });

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'VALIDATION_ERROR' ? 400
                        : result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : 500;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({ dictionary: result.data.dictionary });
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
    const dictionaryId = parseInt(id);
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リクエストボディ解析
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { phrase, category, notes } = body;

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new UpdateDictionaryUseCase(repositories);

    // UseCase実行
    const result = await useCase.execute({
      dictionaryId,
      currentUserId: user.id,
      phrase,
      category,
      notes
    });

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : result.code === 'VALIDATION_ERROR' ? 400
                        : 500;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const dictionaryId = parseInt(id);
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リポジトリコンテナとUseCase作成
    const repositories = await getRepositories(supabase);
    const useCase = new DeleteDictionaryUseCase(repositories);

    // UseCase実行
    const result = await useCase.execute({
      dictionaryId,
      currentUserId: user.id
    });

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'AUTHENTICATION_ERROR' ? 401
                        : result.code === 'AUTHORIZATION_ERROR' ? 403
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : result.code === 'VALIDATION_ERROR' ? 400
                        : 500;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({ message: result.data.message });
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, {
      status: 500,
    });
  }
}
