import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'

import { createEmbedding } from '@/lib/ai-client'
import { getRepositories } from '@/lib/repositories'
import { createAdminClient } from '@/lib/supabase/admin'

// Verify QStash signature
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('Upstash-Signature') ?? ''

    const isValid = await receiver.verify({
      signature,
      body: rawBody,
      url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/dictionaries/embeddings/qstash`,
    })

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { dictionaryId, organizationId, phrase } = JSON.parse(rawBody ?? '{}') as {
      dictionaryId: number
      organizationId: number
      phrase: string
    }

    if (!dictionaryId || !organizationId || !phrase) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const repositories = await getRepositories(supabase)

    // regenerate embedding
    const vector = await createEmbedding(phrase)
    const updated = await repositories.dictionaries.updateVector(dictionaryId, vector)

    if (!updated) {
      console.error('Failed to update dictionary vector')
      return NextResponse.json({ error: 'Failed to update dictionary vector' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('QStash worker error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}


