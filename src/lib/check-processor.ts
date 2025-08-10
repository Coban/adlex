


import { cache, CacheUtils } from '@/lib/cache'
import { createClient } from '@/lib/supabase/server'
import { LegacyCombinedPhrase as CombinedPhrase, LegacyViolationData as ViolationData } from '@/types'

/**
 * チェック処理を完了し結果をデータベースに保存する
 * 違反データの挿入、チェックステータスの更新、組織使用量の増加を行う
 * @param checkId チェックID
 * @param modifiedText 修正されたテキスト
 * @param violations 検出された違反データ
 * @param supabase Supabaseクライアント
 */
async function completeCheck(
  checkId: number,
  modifiedText: string,
  violations: ViolationData[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // Completing check process

  // 違反データを挿入
  if (violations.length > 0) {
      const violationRows = violations.map(violation => ({
      check_id: checkId,
      start_pos: violation.start_pos,
      end_pos: violation.end_pos,
      reason: violation.reason,
      dictionary_id: violation.dictionary_id ?? null
    }))

    const { error: violationError } = await supabase
      .from('violations')
      .insert(violationRows)

    if (violationError) {
      console.error(`[CHECK] Error inserting violations for check ${checkId}:`, violationError)
      throw new Error(`Failed to insert violations: ${violationError.message}`)
    }
  }

  // チェックステータスを完了に更新
  const { error: updateError } = await supabase
    .from('checks')
    .update({
      modified_text: modifiedText,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', checkId)

  if (updateError) {
    console.error(`[CHECK] Error updating check ${checkId} status:`, updateError)
    throw new Error(`Failed to update check status: ${updateError.message}`)
  }

  // 組織の使用量を増加
  const organizationId = await getCheckOrganizationId(checkId, supabase)
  const { error: usageError } = await supabase.rpc('increment_organization_usage', { 
    org_id: organizationId 
  })

  if (usageError) {
    console.error(`[CHECK] Error incrementing usage for check ${checkId}:`, usageError)
  }

  // Check completed successfully
}

async function getCheckOrganizationId(
  checkId: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data, error } = await supabase
    .from('checks')
    .select('organization_id')
    .eq('id', checkId)
    .single()

  if (error || !data) {
    throw new Error(`Failed to get organization_id for check ${checkId}`)
  }

  return data.organization_id
}

// Helper function to manually extract fields from malformed responses


/**
 * チェック処理のメイン関数
 * タイムアウト保護を含む包括的なエラーハンドリングを提供
 * @param checkId チェックID
 * @param text 処理対象のテキスト
 * @param organizationId 組織ID
 * @param inputType 入力タイプ（'text' | 'image'）
 * @param imageUrl 画像URLオプション（画像処理時）
 */
export async function processCheck(
  checkId: number, 
  text: string, 
  organizationId: number,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  const supabase = await createClient()
  
  // タイムアウト保護設定（画像処理: 60秒、テキスト処理: 30秒）
  const timeoutMs = inputType === 'image' ? 60000 : 30000
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`処理がタイムアウトしました（${timeoutMs / 1000}秒）`))
    }, timeoutMs)
  })

  try {
    // 全処理をタイムアウトでラップ
    await Promise.race([
      performActualCheck(checkId, text, organizationId, supabase, inputType, imageUrl),
      timeoutPromise
    ])
  } catch (error) {
    console.error(`[CHECK] Error processing check ${checkId}:`, error)

    // より具体的なエラーメッセージを生成
    let errorMessage = 'チェック処理中にエラーが発生しました'
    if (error instanceof Error) {
      if (error.message.includes('処理がタイムアウトしました')) {
        errorMessage = inputType === 'image' 
          ? '画像処理がタイムアウトしました。もう一度お試しください。'
          : 'チェック処理がタイムアウトしました。もう一度お試しください。'
      } else if (error.message.includes('Failed to create embedding')) {
        errorMessage = 'テキスト解析エラー: 埋め込みベクトルの生成に失敗しました'
      } else if (error.message.includes('Failed to create chat completion')) {
        errorMessage = `AI分析エラー: テキスト処理に失敗しました - ${error.message}`
      } else if (error.message.includes('OpenAI did not return expected function call')) {
        errorMessage = 'AI分析エラー: OpenAI応答形式が期待と異なります'
      } else if (error.message.includes('LM Studio did not return content')) {
        errorMessage = 'AI分析エラー: LM Studio応答が空です'
      } else if (error.message.includes('No JSON found in LM Studio response')) {
        errorMessage = 'AI分析エラー: LM Studio応答にJSON形式が見つかりません'
      } else if (error.message.includes('Invalid modified field') || error.message.includes('Invalid violations field')) {
        errorMessage = 'AI分析エラー: LM Studio応答形式が無効です'
      } else if (error.message.includes('OCR processing failed')) {
        errorMessage = 'OCR処理エラー: 画像からテキストを抽出できませんでした'
      } else if (error.message.includes('Image processing failed')) {
        errorMessage = '画像処理エラー: 画像の読み込みに失敗しました'
      } else {
        errorMessage = `処理エラー: ${error.message}`
      }
    }

    // ステータスを失敗に更新（エラーメッセージ付き）
    const { error: updateError } = await supabase
      .from('checks')
      .update({ 
        status: 'failed',
        error_message: errorMessage
      })
      .eq('id', checkId)
    
    if (updateError) {
      console.error(`[CHECK] Failed to update check ${checkId} status:`, updateError)
    }
    
    throw error // 呼び出し元でのハンドリングのため再スロー
  }
}

/**
 * 実際のチェック処理を実行する内部関数
 * OCR処理（画像の場合）、類似フレーズ検索、AI分析を順次実行
 * @param checkId チェックID
 * @param text 処理対象のテキスト
 * @param organizationId 組織ID
 * @param supabase Supabaseクライアント
 * @param inputType 入力タイプ
 * @param imageUrl 画像URL（画像処理時）
 */
async function performActualCheck(
  checkId: number,
  text: string,
  organizationId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  // Starting check process

  // ステータスを処理中に更新
  await supabase
    .from('checks')
    .update({ status: 'processing' })
    .eq('id', checkId)

  // 画像の場合、最初にOCR処理を実行
  let processedText = text
  if (inputType === 'image' && imageUrl) {
    // Processing OCR for image input
    
    // OCRステータスを処理中に更新
    await supabase
      .from('checks')
      .update({ ocr_status: 'processing' })
      .eq('id', checkId)

    try {
      // LLMによるOCR実行
      const { extractTextFromImageWithLLM, estimateOcrConfidence } = await import('@/lib/ai-client')
      const start = Date.now()
      const ocr = await extractTextFromImageWithLLM(imageUrl)
      processedText = (ocr.text ?? '').trim()
      if (!processedText) {
        throw new Error('Empty OCR result')
      }
      const confidence = estimateOcrConfidence(processedText)

      // 抽出テキストとOCR完了をデータベースに記録
      await supabase
        .from('checks')
        .update({ 
          extracted_text: processedText,
          ocr_status: 'completed',
          ocr_metadata: {
            provider: ocr.provider,
            model: ocr.model,
            language: 'ja',
            processing_time_ms: Date.now() - start,
            confidence
          }
        })
        .eq('id', checkId)

    } catch (ocrError) {
      console.error(`[CHECK] OCR processing failed for check ${checkId}:`, ocrError)
      
      await supabase
        .from('checks')
        .update({ 
          ocr_status: 'failed',
          ocr_metadata: {
            error: ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'
          }
        })
        .eq('id', checkId)
        
      throw new Error('OCR processing failed')
    }
  }

  // 処理済みテキストを使用して通常のテキスト処理を継続
  // Processing text analysis

  // 組織+テキストハッシュごとの類似フレーズキャッシュキー
  const textHash = CacheUtils.hashText(processedText)
  const similarKey = CacheUtils.similarPhrasesKey(organizationId, textHash)

  // まずキャッシュを確認
  let combinedPhrases = cache.get<CombinedPhrase[]>(similarKey)

  if (!combinedPhrases) {
    // 意味的類似性チェック用の埋め込みを作成（テキストハッシュでキャッシュしてAPI呼び出し削減）
    const embeddingKey = `emb:${textHash}`
    let embedding = cache.get<number[]>(embeddingKey)

    if (!embedding) {
      const { createEmbedding } = await import('@/lib/ai-client')
      try {
        embedding = await createEmbedding(processedText)
        cache.set(embeddingKey, embedding, 10 * 60 * 1000) // 10分TTL
      } catch (embeddingError) {
        console.error(`[CHECK] Failed to create embedding for check ${checkId}:`, embeddingError)
        throw new Error(`Failed to create embedding: ${embeddingError}`)
      }
    }

    // 最適化された統合類似フレーズ関数を使用（パフォーマンス最適化）
    const { data, error: combinedError } = await (supabase as unknown as {
      rpc: (
        fn: 'get_combined_similar_phrases',
        args: {
          input_text: string
          org_id: number
          trgm_threshold: number
          vector_threshold: number
          query_embedding: string
          max_results: number
        }
      ) => Promise<{ data: CombinedPhrase[]; error: { message: string } | null }>
    }).rpc(
      'get_combined_similar_phrases',
      { 
        input_text: processedText,
        org_id: organizationId,
        trgm_threshold: 0.3,
        vector_threshold: 0.75,
        query_embedding: JSON.stringify(embedding),
        max_results: 50
      }
    )

    if (combinedError) {
      console.error(`[CHECK] Error getting combined similar phrases for check ${checkId}:`, combinedError)
      throw new Error(`Failed to get combined similar phrases: ${combinedError.message}`)
    }

    combinedPhrases = Array.isArray(data) ? data : []
    // 類似フレーズを5分キャッシュ（同一テキストの再チェック高速化）
    cache.set(similarKey, combinedPhrases, 5 * 60 * 1000)
  } else {
    // Using cached similar phrases
  }

  if (!combinedPhrases || combinedPhrases.length === 0) {
    // No similar phrases found - completing with no violations
    await completeCheck(checkId, processedText, [], supabase)
    return
  }

  // Found similar phrases for analysis

  // NGエントリーをフィルターして内部形式に変換
  const relevantEntries = combinedPhrases
    .filter(entry => entry.category === 'NG')
    .map(entry => ({
      id: entry.id,
      phrase: entry.phrase,
      category: entry.category,
      similarity: entry.combined_score // 関連性には統合スコアを使用
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))

  if (relevantEntries.length === 0) {
    // No relevant NG phrases found - completing with no violations
    await completeCheck(checkId, processedText, [], supabase)
    return
  }

  // AIに渡すエントリー数を制限してトークン使用量と応答時間を削減
  const MAX_AI_ENTRIES = 30
  const limitedEntries = relevantEntries.slice(0, MAX_AI_ENTRIES)

  // Processing relevant NG phrases with AI

  // AIを使用して分析し違反を生成
  const { createChatCompletionForCheck } = await import('@/lib/ai-client')

  try {
      const result = await createChatCompletionForCheck(processedText, limitedEntries)
      
    let violations: ViolationData[]
    let modifiedText: string

    if (result.type === 'openai') {
      const responseAny = result.response as unknown as { choices?: Array<{ message?: { function_call?: { arguments?: string } } }> }
      const functionCall = responseAny?.choices?.[0]?.message?.function_call
      if (!functionCall) {
        throw new Error('OpenAI did not return expected function call')
      }
      
      const analysisResult = JSON.parse(functionCall.arguments ?? '{}') as {
        modified?: string
        violations?: Array<{ start: number; end: number; reason: string; dictionaryId?: number }>
      }
      // OpenAI形式から内部形式に変換
      violations = (analysisResult.violations ?? []).map((v) => ({
        start_pos: v.start,
        end_pos: v.end,
        reason: v.reason,
        dictionary_id: v.dictionaryId
      }))
      modifiedText = analysisResult.modified ?? processedText
    } else {
      violations = result.violations
      modifiedText = result.modified
    }

      await completeCheck(checkId, modifiedText, violations, supabase)
      
  } catch (aiError) {
    console.error(`[CHECK] AI processing failed for check ${checkId}:`, aiError)
    throw new Error(`Failed to create chat completion: ${aiError}`)
  }
}