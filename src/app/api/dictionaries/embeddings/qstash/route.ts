import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'

import { getRepositories } from '@/core/ports'
import { UpdateEmbeddingUseCase } from '@/core/usecases/dictionaries/updateEmbedding'
import { createAdminClient } from '@/infra/supabase/adminClient'

// Verify QStash signature
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('Upstash-Signature') ?? ''

    // QStash署名検証
    const isValid = await receiver.verify({
      signature,
      body: rawBody,
      url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/dictionaries/embeddings/qstash`,
    })

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // リクエストボディ解析
    const { dictionaryId, organizationId, phrase } = JSON.parse(rawBody ?? '{}') as {
      dictionaryId: number
      organizationId: number
      phrase: string
    }

    // リポジトリコンテナとUseCase作成
    const supabase = createAdminClient()
    const repositories = await getRepositories(supabase)
    const useCase = new UpdateEmbeddingUseCase(repositories)

    // UseCase実行
    const result = await useCase.execute({
      dictionaryId,
      organizationId,
      phrase
    })

    // 結果処理
    if (!result.success) {
      const statusCode = result.code === 'VALIDATION_ERROR' ? 400 
                        : result.code === 'NOT_FOUND_ERROR' ? 404
                        : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('QStash worker error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}


