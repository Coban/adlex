


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
  console.log(`[CHECK] Starting processCheck for check ${checkId} (type: ${inputType}, textLength: ${text.length})`)
  const supabase = await createClient()
  
  // タイムアウト保護設定（画像処理: 120秒、テキスト処理: 120秒）- AI API遅延に対応
  const timeoutMs = inputType === 'image' ? 120000 : 120000
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
/**
 * AI処理のリトライ機能付きラッパー関数
 * 複数チェック時のAI API遅延やエラーに対する耐性を向上
 */
async function retryAiRequest<T>(
  operation: () => Promise<T>,
  checkId: number,
  maxRetries = 2,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CHECK] AI request attempt ${attempt + 1}/${maxRetries + 1} for check ${checkId}`)
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.warn(`[CHECK] AI request attempt ${attempt + 1} failed for check ${checkId}:`, error)
      
      // 最後の試行の場合はリトライせずエラーを投げる
      if (attempt === maxRetries) {
        break
      }
      
      // 指数バックオフで待機
      const delay = baseDelayMs * Math.pow(2, attempt)
      console.log(`[CHECK] Retrying AI request for check ${checkId} in ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError ?? new Error('Unknown error')
}

async function performActualCheck(
  checkId: number,
  text: string,
  organizationId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  console.log(`[CHECK] Starting actual check processing for check ${checkId}`)

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
  console.log(`[CHECK] Starting text analysis for check ${checkId} with text: "${processedText.substring(0, 50)}..."`)

  // 辞書から参考情報を取得（必須ではない）
  let referenceEntries: Array<{ id: number; phrase: string; category: string; similarity?: number }> = []
  
  // 組織+テキストハッシュごとの類似フレーズキャッシュキー
  const textHash = CacheUtils.hashText(processedText)
  const similarKey = CacheUtils.similarPhrasesKey(organizationId, textHash)

  // まずキャッシュを確認
  let combinedPhrases = cache.get<CombinedPhrase[]>(similarKey)

  if (!combinedPhrases) {
    // 長い文章の埋め込み生成最適化
    const embeddingKey = `emb:${textHash}`
    let embedding = cache.get<number[]>(embeddingKey)

    if (!embedding) {
      const { createEmbedding } = await import('@/lib/ai-client')
      try {
        console.log(`[CHECK] Creating embedding for check ${checkId} (text length: ${processedText.length})`)
        
        // 長い文章は先頭部分のみで埋め込み生成（パフォーマンス最適化）
        const embeddingText = processedText.length > 1000 
          ? processedText.substring(0, 1000) + '...'
          : processedText
        
        const startTime = Date.now()
        embedding = await createEmbedding(embeddingText)
        const embeddingTime = Date.now() - startTime
        console.log(`[CHECK] Embedding created for check ${checkId} in ${embeddingTime}ms`)
        
        cache.set(embeddingKey, embedding, 15 * 60 * 1000) // 15分TTL（長い文章用に延長）
      } catch (embeddingError) {
        console.error(`[CHECK] Failed to create embedding for check ${checkId}:`, embeddingError)
        // 埋め込み生成に失敗しても処理は継続（辞書なしでLLM分析）
        console.log(`[CHECK] Continuing without dictionary reference for check ${checkId}`)
      }
    } else {
      console.log(`[CHECK] Using cached embedding for check ${checkId}`)
    }

    // 埋め込みが利用可能な場合のみ辞書検索を実行
    if (embedding) {
      // 長い文章用の最適化された類似フレーズ検索
      console.log(`[CHECK] Starting similarity search for check ${checkId} (text length: ${processedText.length})`)
      const searchStartTime = Date.now()
      
      // 長い文章の場合は検索パラメータを調整してパフォーマンス向上
      const isLongText = processedText.length > 500
      const searchText = isLongText ? processedText.substring(0, 500) + '...' : processedText
      const maxResults = isLongText ? 30 : 50 // 長い文章は結果数を制限
      const vectorThreshold = isLongText ? 0.7 : 0.75 // 長い文章は閾値を下げて高速化
      
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
          input_text: searchText,
          org_id: organizationId,
          trgm_threshold: 0.3,
          vector_threshold: vectorThreshold,
          query_embedding: JSON.stringify(embedding),
          max_results: maxResults
        }
      )
      
      const searchTime = Date.now() - searchStartTime
      console.log(`[CHECK] Similarity search completed for check ${checkId} in ${searchTime}ms`)

      if (combinedError) {
        console.error(`[CHECK] Error getting combined similar phrases for check ${checkId}:`, combinedError)
        console.log(`[CHECK] Continuing without dictionary reference for check ${checkId}`)
      } else {
        combinedPhrases = Array.isArray(data) ? data : []
        // 類似フレーズを5分キャッシュ（同一テキストの再チェック高速化）
        cache.set(similarKey, combinedPhrases, 5 * 60 * 1000)
      }
    }
  }

  // 辞書から参考情報を抽出（NGエントリーのみ）
  if (combinedPhrases && combinedPhrases.length > 0) {
    referenceEntries = combinedPhrases
      .filter(entry => entry.category === 'NG')
      .map(entry => ({
        id: entry.id,
        phrase: entry.phrase,
        category: entry.category,
        similarity: entry.combined_score // 関連性には統合スコアを使用
      }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))

    // AIに渡すエントリー数を制限してトークン使用量と応答時間を削減
    const MAX_REFERENCE_ENTRIES = 20
    referenceEntries = referenceEntries.slice(0, MAX_REFERENCE_ENTRIES)
    
    console.log(`[CHECK] Found ${referenceEntries.length} reference dictionary entries for check ${checkId}`)
  } else {
    console.log(`[CHECK] No dictionary reference found for check ${checkId}, proceeding with LLM-only analysis`)
  }

  console.log(`[CHECK] Starting AI analysis for check ${checkId} with ${referenceEntries.length} reference entries`)

  // LLMを使用して薬機法違反を分析（辞書は参考情報として使用）
  const { createChatCompletionForCheck } = await import('@/lib/ai-client')

  try {
    console.log(`[CHECK] Calling createChatCompletionForCheck for check ${checkId}`)
    const result = await retryAiRequest(
      () => createChatCompletionForCheck(processedText, referenceEntries),
      checkId,
      2, // 最大2回リトライ
      1500 // 1.5秒から開始
    )
    console.log(`[CHECK] AI analysis completed for check ${checkId}`)
      
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