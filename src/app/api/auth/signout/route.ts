import { NextRequest, NextResponse } from 'next/server'

import {
  createErrorResponse,
  createSuccessResponse
} from '@/core/dtos/auth'
import { SignOutUseCase } from '@/core/usecases/auth/signOut'

/**
 * サインアウトAPI（リファクタリング済み）
 * usecase 呼び出し → HTTP 変換の薄い層
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Supabaseレスポンスオブジェクトを準備（クッキー書き込み用）
    const supabaseResponse = NextResponse.json({ success: true })

    // ユースケース実行
    const signOutUseCase = new SignOutUseCase(supabaseUrl, supabaseAnonKey)
    const result = await signOutUseCase.execute(
      {}, // 入力パラメータなし
      request.cookies.getAll(),
      (name: string, value: string, options?: Record<string, unknown>) => {
        supabaseResponse.cookies.set(name, value, options)
      }
    )

    // 結果の処理
    if (!result.success) {
      return NextResponse.json(
        createErrorResponse(result.error.code, result.error.message),
        { status: 500, headers: supabaseResponse.headers }
      )
    }

    // 成功レスポンス
    return NextResponse.json(
      createSuccessResponse(result.data),
      { headers: supabaseResponse.headers }
    )

  } catch (error) {
    console.error("サインアウトAPI エラー:", error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'サーバーエラーが発生しました'),
      { status: 500 }
    )
  }
}


