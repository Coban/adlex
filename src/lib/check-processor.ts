import { createClient } from '@/infra/supabase/serverClient'
import { cache, CacheUtils } from '@/lib/cache'
import { LegacyCombinedPhrase as CombinedPhrase, LegacyViolationData as ViolationData } from '@/types'

/**
 * チェック処理を完了し結果をデータベースへ反映する。
 *
 * 処理内容:
 * - `violations` があれば `violations` テーブルへ一括挿入
 * - `checks` レコードを `completed` に更新し、`modified_text` と `completed_at` を記録
 * - チェックに紐づく組織の使用量を `increment_organization_usage` で加算
 *
 * 失敗時の挙動:
 * - 挿入/更新いずれかでエラーがあれば `Error` を投げ呼び出し側へ委譲
 *
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
      throw new Error(`違反データの挿入に失敗しました: ${violationError.message}`)
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
    console.error(`[CHECK] チェック ${checkId} のステータス更新でエラーが発生しました:`, updateError)
    throw new Error(`チェックのステータス更新に失敗しました: ${updateError.message}`)
  }

  // 組織の使用量を増加
  const organizationId = await getCheckOrganizationId(checkId, supabase)
  const { error: usageError } = await supabase.rpc('increment_organization_usage', { 
    org_id: organizationId 
  })

  if (usageError) {
    console.error(`[CHECK] チェック ${checkId} の使用量加算でエラーが発生しました:`, usageError)
  }
}

/**
 * 指定されたチェックに紐づく `organization_id` を取得する。
 *
 * 処理内容:
 * - `checks` テーブルから単一行取得（`id`=checkId）
 * - 取得できない場合は `Error` を投げる
 *
 * @param checkId チェックID
 * @param supabase Supabaseクライアント
 * @returns 取得した `organization_id`
 */
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
    throw new Error(`チェック${checkId}のorganization_id取得に失敗しました`)
  }

  return data.organization_id
}

// Helper function to manually extract fields from malformed responses


/**
 * チェック処理のエントリーポイント。
 *
 * 処理内容:
 * - Supabaseクライアントを生成
 * - 全体処理にタイムアウト保護を付与（画像/テキストとも既定: 120秒）
 * - 実際の処理（OCR→類似検索→AI解析→保存）を `performActualCheck` に委譲
 * - 例外発生時はユーザー向けエラー文言を決定し、`checks.status='failed'` と `error_message` を更新
 *
 * @param checkId チェックID
 * @param text 処理対象のテキスト
 * @param organizationId 組織ID
 * @param inputType 入力タイプ（'text' | 'image'）
 * @param imageUrl 画像URL（画像処理時）
 */
export async function processCheck(
  checkId: number, 
  text: string, 
  organizationId: number,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  const supabase = await createClient()
  
  // タイムアウト保護設定（画像処理: 120秒、テキスト処理: 120秒）- AI API遅延に対応
  const timeoutMs = inputType === 'image' ? 120000 : 120000
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`処理がタイムアウトしました（${timeoutMs / 1000}秒）`))
    }, timeoutMs)
  })

  try {
    await Promise.race([
      performActualCheck(checkId, text, organizationId, supabase, inputType, imageUrl),
      timeoutPromise
    ])
  } catch (error) {
    console.error(`[CHECK] チェック ${checkId} の処理中にエラーが発生しました:`, error)

    // より具体的なエラーメッセージを生成
    let errorMessage = 'チェック処理中にエラーが発生しました'
    if (error instanceof Error) {
      const msg = error.message || ''
      if (msg.includes('処理がタイムアウトしました')) {
        errorMessage = inputType === 'image' 
          ? '画像処理がタイムアウトしました。もう一度お試しください。'
          : 'チェック処理がタイムアウトしました。もう一度お試しください。'
      } 
      // 埋め込み失敗（日英両対応）
      else if (
        [
          '埋め込みの作成に失敗しました',
          'LM Studio埋め込みに失敗しました',
          'OpenAI埋め込みクライアントが利用できません',
          'OpenAI APIから埋め込みデータが返されませんでした',
          'LM Studio埋め込み応答にデータがありません',
          'Failed to create embedding', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'テキスト解析エラー: 埋め込みベクトルの生成に失敗しました'
      } 
      // チャット完了作成失敗（日英両対応）
      else if (
        [
          'チャット完了の作成に失敗しました',
          'LM Studioチャット完了に失敗しました',
          'Failed to create chat completion', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = `AI分析エラー: テキスト処理に失敗しました - ${msg}`
      } 
      // OpenAI/OR 応答形式不一致（日英両対応）
      else if (
        [
          'OpenAI/OpenRouterの応答に期待したfunction/tool callが含まれていません',
          'OpenAI did not return expected function call', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'AI分析エラー: OpenAI応答形式が期待と異なります'
      } 
      // LM Studio 応答が空（日英両対応）
      else if (
        [
          'LM Studioが応答内容を返しませんでした',
          'LM Studio did not return content', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'AI分析エラー: LM Studio応答が空です'
      } 
      // LM Studio JSONが見つからない（日英両対応）
      else if (
        [
          'LM Studio応答にJSON形式が見つかりませんでした',
          'No JSON found in LM Studio response', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'AI分析エラー: LM Studio応答にJSON形式が見つかりません'
      } 
      // LM Studio 応答のフィールドが無効（日英両対応）
      else if (
        [
          '応答の修正フィールドが無効です',
          '応答の違反フィールドが無効です',
          'Invalid modified field', // 旧英語
          'Invalid violations field', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'AI分析エラー: LM Studio応答形式が無効です'
      } 
      // OCR処理失敗（日英両対応）
      else if (
        [
          'OCR処理に失敗しました',
          'OCR processing failed', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = 'OCR処理エラー: 画像からテキストを抽出できませんでした'
      } 
      // 画像読み込み失敗（新規日本語にも対応）
      else if (
        [
          '画像の読み込みに失敗',
          'Image processing failed', // 旧英語
        ].some((s) => msg.includes(s))
      ) {
        errorMessage = '画像処理エラー: 画像の読み込みに失敗しました'
      } else {
        errorMessage = `処理エラー: ${msg}`
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
      console.error(`[CHECK] チェック ${checkId} の失敗ステータス更新に失敗しました:`, updateError)
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
 * AI処理用のリトライラッパー。
 *
 * 処理内容:
 * - 最大 `maxRetries+1` 回 `operation` を実行
 * - 失敗時は指数バックオフで待機後に再試行
 * - 最終試行まで失敗した場合は最後のエラー、または不明エラーを投げる
 *
 * @param operation 実行する非同期処理
 * @param checkId ログ/文脈用のチェックID
 * @param maxRetries 最大リトライ回数（デフォルト: 2）
 * @param baseDelayMs バックオフ基準ミリ秒（デフォルト: 1000）
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
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError ?? new Error('不明なエラーが発生しました')
}

/**
 * 実際のチェック処理を行う。
 *
 * 処理内容:
 * - `checks.status` を `processing` に更新
 * - 入力が画像の場合: OCR 実行→抽出テキスト/メタデータを保存（失敗時は `ocr_status='failed'`）
 * - テキストに対して、埋め込み生成→類似フレーズ検索（キャッシュ利用・条件付き実行）
 * - NGカテゴリの参考辞書エントリーを抽出・上位にソート・件数制限
 * - LLMで薬機法違反を分析（OpenAI/LM Studio 形式を吸収）
 * - `completeCheck` にて違反・修正文の保存と完了処理
 *
 * @param checkId チェックID
 * @param text 入力テキスト
 * @param organizationId 組織ID
 * @param supabase Supabaseクライアント
 * @param inputType 入力タイプ
 * @param imageUrl 画像URL
 */
async function performActualCheck(
  checkId: number,
  text: string,
  organizationId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputType: 'text' | 'image' = 'text',
  imageUrl?: string
) {
  await supabase
    .from('checks')
    .update({ status: 'processing' })
    .eq('id', checkId)

  // 画像の場合、最初にOCR処理を実行
  let processedText = text
  if (inputType === 'image' && imageUrl) {
    
    // OCRステータスを処理中に更新
    await supabase
      .from('checks')
      .update({ ocr_status: 'processing' })
      .eq('id', checkId)

    try {
      const { extractTextFromImageWithLLM, estimateOcrConfidence } = await import('@/lib/ai-client')
      const start = Date.now()
      const ocr = await extractTextFromImageWithLLM(imageUrl)
      processedText = (ocr.text ?? '').trim()
      if (!processedText) {
        throw new Error('OCR結果が空です')
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
      console.error(`[CHECK] チェック ${checkId} のOCR処理に失敗しました:`, ocrError)
      
      await supabase
        .from('checks')
        .update({ 
          ocr_status: 'failed',
          ocr_metadata: {
            error: ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'
          }
        })
        .eq('id', checkId)
        
      throw new Error('OCR処理に失敗しました')
    }
  }

  // 処理済みテキストを使用して通常のテキスト処理を継続
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
        
        // 長い文章は先頭部分のみで埋め込み生成（パフォーマンス最適化）
        const embeddingText = processedText.length > 1000 
          ? processedText.substring(0, 1000) + '...'
          : processedText
        embedding = await createEmbedding(embeddingText)
        cache.set(embeddingKey, embedding, 15 * 60 * 1000) // 15分TTL（長い文章用に延長）
      } catch (embeddingError) {
        console.error(`[CHECK] チェック ${checkId} の埋め込み生成に失敗しました:`, embeddingError)
        // 埋め込み生成に失敗しても処理は継続（辞書なしでLLM分析）
      }
    } else {
    }

    // 埋め込みが利用可能な場合のみ辞書検索を実行
    if (embedding) {
      
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

      if (combinedError) {
        console.error(`[CHECK] チェック ${checkId} の類似フレーズ取得でエラーが発生しました:`, combinedError)
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
  } else {
  }

  // LLMを使用して薬機法違反を分析（辞書は参考情報として使用）
  const { createChatCompletionForCheck } = await import('@/lib/ai-client')

  try {
    const result = await retryAiRequest(
      () => createChatCompletionForCheck(processedText, referenceEntries),
      checkId,
      2, // 最大2回リトライ
      1500 // 1.5秒から開始
    )
      
    let violations: ViolationData[]
    let modifiedText: string

    if (result.type === 'openai' || result.type === 'openrouter') {
      // OpenAI/OpenRouter 双方で function_call または tool_calls をサポート
      const responseAny = result.response as unknown as {
        choices?: Array<{
          message?: {
            function_call?: { arguments?: string }
            tool_calls?: Array<{
              type?: string
              function?: { name?: string; arguments?: string }
            }>
          }
        }>
      }

      const message = responseAny?.choices?.[0]?.message as
        | {
            function_call?: { arguments?: string }
            tool_calls?: Array<{ type?: string; function?: { name?: string; arguments?: string } }>
          }
        | undefined

      // 1) OpenAI 互換の function_call.arguments
      let argsJson: string | null = message?.function_call?.arguments ?? null

      // 2) tool_calls 配列（OpenRouter/一部OpenAI実装）
      const toolCalls = Array.isArray(message?.tool_calls) ? message?.tool_calls : []
      if (!argsJson && toolCalls.length > 0) {
        const targetCall =
          toolCalls.find(
            (tc) => tc?.type === 'function' && tc.function?.name === 'apply_yakukiho_rules'
          ) ?? toolCalls[0]
        argsJson = targetCall?.function?.arguments ?? null
      }

      if (!argsJson?.trim()) {
        throw new Error('OpenAI/OpenRouterの応答に期待したfunction/tool callが含まれていません')
      }

      const analysisResult = JSON.parse(argsJson) as {
        modified?: string
        violations?: Array<{ start: number; end: number; reason: string; dictionaryId?: number }>
      }

      // 共通形式から内部形式に変換
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
    console.error(`[CHECK] チェック ${checkId} のAI処理に失敗しました:`, aiError)
    throw new Error(`チャット補完の作成に失敗しました: ${aiError}`)
  }
}