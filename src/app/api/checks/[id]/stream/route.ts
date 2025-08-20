import { NextRequest } from 'next/server'

import {
  validateStreamCheckUpdatesParams,
  formatSSEMessage,
  StreamEventType,
  createErrorResponse
} from '@/core/dtos/streaming'
import { getRepositories } from '@/core/ports'
import { StreamCheckUpdatesUseCase } from '@/core/usecases/checks/streamCheckUpdates'
import { createClient } from '@/infra/supabase/serverClient'

/**
 * Server-Sent Events (SSE) を使用してチェック処理の進捗をリアルタイムでストリーミングする（リファクタリング済み）
 * DTO validate → usecase 呼び出し → HTTP 変換の薄い層
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // パラメータのバリデーション
    const { id } = await params
    const paramsValidation = validateStreamCheckUpdatesParams({ id })
    if (!paramsValidation.success) {
      return new Response(
        formatSSEMessage(StreamEventType.Error, createErrorResponse(
          paramsValidation.error.code,
          paramsValidation.error.message,
          paramsValidation.error.details
        )),
        { status: 400, headers: getSSEHeaders() }
      )
    }

    const checkId = parseInt(paramsValidation.data.id)
    const supabase = await createClient()

    // クエリパラメータからトークンを取得（EventSourceはheaderを送れないため）
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    
    // 認証チェック（トークンがある場合は明示的に設定）
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return new Response(
          formatSSEMessage(StreamEventType.Error, createErrorResponse(
            'AUTHENTICATION_ERROR',
            '認証が必要です（トークン無効）'
          )),
          { status: 401, headers: getSSEHeaders() }
        )
      }
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return new Response(
          formatSSEMessage(StreamEventType.Error, createErrorResponse(
            'AUTHENTICATION_ERROR',
            '認証が必要です'
          )),
          { status: 401, headers: getSSEHeaders() }
        )
      }
    }
    
    // ユーザー情報を再取得（上記のどちらのパスでも user が設定されている）
    const { data: { user }, error: finalAuthError } = token 
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()
    if (finalAuthError || !user) {
      return new Response(
        formatSSEMessage(StreamEventType.Error, createErrorResponse(
          'AUTHENTICATION_ERROR',
          '最終認証チェックに失敗しました'
        )),
        { status: 401, headers: getSSEHeaders() }
      )
    }

    // リポジトリコンテナの取得
    const repositories = await getRepositories(supabase)

    // ReadableStreamを作成してSSEを処理
    const stream = new ReadableStream({
      start(controller) {
        // UseCaseを初期化
        const streamUseCase = new StreamCheckUpdatesUseCase(repositories)

        // ストリーミング開始
        streamUseCase.execute({
          checkId,
          currentUserId: user.id,
          signal: request.signal,
          onUpdate: (data) => {
            const message = formatSSEMessage(StreamEventType.Progress, data)
            controller.enqueue(new TextEncoder().encode(message))
          },
          onComplete: (data) => {
            const message = formatSSEMessage(StreamEventType.Complete, data)
            controller.enqueue(new TextEncoder().encode(message))
            controller.close()
            streamUseCase.cleanup()
          },
          onError: (error) => {
            const message = formatSSEMessage(StreamEventType.Error, error)
            controller.enqueue(new TextEncoder().encode(message))
            controller.close()
            streamUseCase.cleanup()
          },
          onHeartbeat: (count) => {
            try {
              if (controller.desiredSize !== null) {
                controller.enqueue(new TextEncoder().encode(`: heartbeat-${count}\n\n`))
              }
            } catch (controllerError) {
              console.error(`[SSE] Controller already closed for heartbeat ${count}:`, controllerError)
              streamUseCase.cleanup()
            }
          }
        }).catch((error) => {
          console.error('[SSE] UseCase execution error:', error)
          const message = formatSSEMessage(StreamEventType.Error, {
            id: checkId,
            status: 'failed',
            error: 'ストリーミング処理でエラーが発生しました'
          })
          controller.enqueue(new TextEncoder().encode(message))
          controller.close()
          streamUseCase.cleanup()
        })

        // 5分後の強制クリーンアップ
        setTimeout(() => {
          streamUseCase.cleanup()
          try { controller.close() } catch { /* already closed */ }
        }, 300000)
      }
    })

    return new Response(stream, { headers: getSSEHeaders() })

  } catch (error) {
    console.error('ストリーミングAPI エラー:', error)
    return new Response(
      formatSSEMessage(StreamEventType.Error, createErrorResponse(
        'INTERNAL_ERROR',
        'サーバーエラーが発生しました'
      )),
      { status: 500, headers: getSSEHeaders() }
    )
  }
}

/**
 * SSEレスポンス用のヘッダーを取得
 */
function getSSEHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Keep-Alive': 'timeout=60, max=10',
    'X-Accel-Buffering': 'no'
  })
}