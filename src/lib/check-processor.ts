


import { cache, CacheUtils } from '@/lib/cache'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

// Type definitions for the API
type DictionaryCategory = Database['public']['Enums']['dictionary_category']

interface CombinedPhrase {
  id: number
  phrase: string
  category: DictionaryCategory
  trgm_similarity?: number
  vector_similarity?: number
  combined_score?: number
}

interface ViolationData {
  start_pos: number
  end_pos: number
  reason: string
  dictionary_id?: number
}

async function completeCheck(
  checkId: number,
  modifiedText: string,
  violations: ViolationData[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  console.log(`[CHECK] Completing check ${checkId} with ${violations.length} violations`)

  // Insert violations
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

  // Update check status to completed
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

  // Increment organization usage
  const organizationId = await getCheckOrganizationId(checkId, supabase)
  const { error: usageError } = await supabase.rpc('increment_organization_usage', { 
    org_id: organizationId 
  })

  if (usageError) {
    console.error(`[CHECK] Error incrementing usage for check ${checkId}:`, usageError)
  }

  console.log(`[CHECK] Successfully completed check ${checkId}`)
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


export async function processCheck(
  checkId: number, 
  text: string, 
  organizationId: number,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  const supabase = await createClient()
  
  // Set up timeout protection (60 seconds for images, 30 for text)
  const timeoutMs = inputType === 'image' ? 60000 : 30000
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`処理がタイムアウトしました（${timeoutMs / 1000}秒）`))
    }, timeoutMs)
  })

  try {
    // Wrap the entire processing in a timeout
    await Promise.race([
      performActualCheck(checkId, text, organizationId, supabase, inputType, imageUrl),
      timeoutPromise
    ])
  } catch (error) {
    console.error(`[CHECK] Error processing check ${checkId}:`, error)

    // Get a more descriptive error message
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

    // Update status to failed with error message
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
    
    throw error // Re-throw to be handled by caller
  }
}

async function performActualCheck(
  checkId: number,
  text: string,
  organizationId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  console.log(`[CHECK] Starting check ${checkId} (${inputType})`)

  // Set status to processing
  await supabase
    .from('checks')
    .update({ status: 'processing' })
    .eq('id', checkId)

  // For images, handle OCR processing first
  let processedText = text
  if (inputType === 'image' && imageUrl) {
    console.log(`[CHECK] Processing image OCR for check ${checkId}`)
    
    // Update OCR status to processing
    await supabase
      .from('checks')
      .update({ ocr_status: 'processing' })
      .eq('id', checkId)

    try {
      // Run OCR via LLM
      const { extractTextFromImageWithLLM, estimateOcrConfidence } = await import('@/lib/ai-client')
      const start = Date.now()
      const ocr = await extractTextFromImageWithLLM(imageUrl)
      processedText = (ocr.text ?? '').trim()
      if (!processedText) {
        throw new Error('Empty OCR result')
      }
      const confidence = estimateOcrConfidence(processedText)

      // Update with extracted text and OCR completion
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

  // Continue with normal text processing using processedText
  console.log(`[CHECK] Processing text analysis for check ${checkId}`)

  // Cache key for similar phrases per org + text hash
  const textHash = CacheUtils.hashText(processedText)
  const similarKey = CacheUtils.similarPhrasesKey(organizationId, textHash)

  // Try cache first
  let combinedPhrases = cache.get<CombinedPhrase[]>(similarKey)

  if (!combinedPhrases) {
    // Create embedding for semantic similarity check (cached by text hash to reduce API calls)
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

    // Use optimized combined similar phrases function (performance optimization)
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
    // Cache similar phrases for 5分（同一テキストの再チェック高速化）
    cache.set(similarKey, combinedPhrases, 5 * 60 * 1000)
  } else {
    console.log(`[CHECK] Using cached similar phrases for check ${checkId} (key=${similarKey})`)
  }

  if (!combinedPhrases || combinedPhrases.length === 0) {
    console.log(`[CHECK] No similar phrases found for check ${checkId}`)
    await completeCheck(checkId, processedText, [], supabase)
    return
  }

  console.log(`[CHECK] Found ${combinedPhrases.length} combined similar phrases for check ${checkId}`)

  // Filter for NG entries and convert to internal format
  const relevantEntries = combinedPhrases
    .filter(entry => entry.category === 'NG')
    .map(entry => ({
      id: entry.id,
      phrase: entry.phrase,
      category: entry.category,
      similarity: entry.combined_score // Use combined score for relevance
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))

  if (relevantEntries.length === 0) {
    console.log(`[CHECK] No relevant NG phrases found for check ${checkId}`)
    await completeCheck(checkId, processedText, [], supabase)
    return
  }

  // Limit entries passed to AI to reduce token usage and response time
  const MAX_AI_ENTRIES = 30
  const limitedEntries = relevantEntries.slice(0, MAX_AI_ENTRIES)

  console.log(`[CHECK] Processing ${limitedEntries.length}/${relevantEntries.length} relevant NG phrases for check ${checkId}`)

  // Use AI to analyze and generate violations
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
      // Convert from OpenAI format to internal format
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