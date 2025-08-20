import { RepositoryContainer } from '@/core/ports'
import { createEmbedding } from '@/lib/ai-client'

export interface UpdateEmbeddingInput {
  dictionaryId: number
  organizationId: number
  phrase: string
}

export type UpdateEmbeddingResult = {
  success: true
  data: {
    ok: boolean
  }
} | {
  success: false
  error: string
  code: 'VALIDATION_ERROR' | 'NOT_FOUND_ERROR' | 'INTERNAL_ERROR'
}

export class UpdateEmbeddingUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: UpdateEmbeddingInput): Promise<UpdateEmbeddingResult> {
    try {
      const { dictionaryId, organizationId, phrase } = input

      // バリデーション
      if (!dictionaryId || !organizationId || !phrase) {
        return {
          success: false,
          error: 'Invalid payload',
          code: 'VALIDATION_ERROR'
        }
      }

      // 埋め込みベクトル生成
      const vector = await createEmbedding(phrase)
      
      // ベクトル更新
      const updated = await this.repositories.dictionaries.updateVector(dictionaryId, vector)

      if (!updated) {
        console.error('Failed to update dictionary vector')
        return {
          success: false,
          error: 'Failed to update dictionary vector',
          code: 'INTERNAL_ERROR'
        }
      }

      return {
        success: true,
        data: { ok: true }
      }

    } catch (error) {
      console.error('Update embedding usecase error:', error)
      return {
        success: false,
        error: (error as Error).message,
        code: 'INTERNAL_ERROR'
      }
    }
  }
}