import { SupabaseClient } from '@supabase/supabase-js'

import { createChatCompletion, createEmbedding, isUsingLMStudio } from '@/lib/ai-client'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

// Type definitions for the API
interface DictionaryEntry {
  id: number
  phrase: string
  category: Database['public']['Enums']['dictionary_category']
  similarity?: number
  notes?: string
}

interface ViolationData {
  start: number
  end: number
  reason: string
  dictionaryId?: number
}

export async function processCheck(checkId: number, text: string, organizationId: number) {
  const supabase = await createClient()
  
  // Set up timeout protection (30 seconds)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('処理がタイムアウトしました（30秒）'))
    }, 30000)
  })

  try {
    // Wrap the entire processing in a timeout
    await Promise.race([
      performActualCheck(checkId, text, organizationId, supabase),
      timeoutPromise
    ])
  } catch (error) {
    console.error(`[CHECK] Error processing check ${checkId}:`, error)

    // Get a more descriptive error message
    let errorMessage = 'チェック処理中にエラーが発生しました'
    if (error instanceof Error) {
      if (error.message.includes('処理がタイムアウトしました')) {
        errorMessage = 'チェック処理がタイムアウトしました。もう一度お試しください。'
      } else if (error.message.includes('Failed to create embedding')) {
        errorMessage = 'テキスト解析エラー: 埋め込みベクトルの生成に失敗しました'
      } else if (error.message.includes('Failed to create chat completion')) {
        errorMessage = 'AI分析エラー: テキスト処理に失敗しました'
      } else if (error.message.includes('OpenAI did not return expected function call')) {
        errorMessage = 'AI分析エラー: OpenAI応答形式が期待と異なります'
      } else if (error.message.includes('LM Studio did not return content')) {
        errorMessage = 'AI分析エラー: LM Studio応答が空です'
      } else if (error.message.includes('No JSON found in LM Studio response')) {
        errorMessage = 'AI分析エラー: LM Studio応答にJSON形式が見つかりません'
      } else if (error.message.includes('Invalid modified field') || error.message.includes('Invalid violations field')) {
        errorMessage = 'AI分析エラー: LM Studio応答形式が無効です'
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

async function performActualCheck(checkId: number, text: string, organizationId: number, supabase: SupabaseClient<Database>) {
  try {
    // Update status to processing
    const { error: statusError } = await supabase
      .from('checks')
      .update({ status: 'processing' })
      .eq('id', checkId)
    
    if (statusError) {
      console.error(`[CHECK] Failed to update status to processing for ID ${checkId}:`, statusError)
      throw new Error(`Failed to update status: ${statusError.message}`)
    }

    // Step 1: Pre-filter using pg_trgm similarity (≥0.3)
    const { data: preFilteredDictionary, error: preFilterError } = await supabase
      .rpc('get_similar_phrases', {
        input_text: text,
        similarity_threshold: 0.3,
        org_id: organizationId
      })

    if (preFilterError) {
      console.warn(`[CHECK] Pre-filter failed for ID ${checkId}, continuing without pre-filtering:`, preFilterError)
    }

    let filteredDictionary = preFilteredDictionary ?? []

    // Step 2: Semantic filtering using vector similarity (distance < 0.25, similarity > 0.75)
    // Only if we have pre-filtered results and they're manageable (< 1000 entries)
    if (filteredDictionary.length > 0 && filteredDictionary.length < 1000) {
      try {
        // Get embeddings for input text
        const inputEmbedding = await createEmbedding(text)

        // Filter by vector similarity using pre-filtered entries
        const { data: vectorFiltered, error: vectorError } = await supabase
          .rpc('get_vector_similar_phrases', {
            query_embedding: JSON.stringify(inputEmbedding),
            similarity_threshold: 0.75, // cosine similarity > 0.75 (distance < 0.25)
            org_id: organizationId
          })

        if (vectorError) {
          console.warn('Vector similarity filtering failed, using pre-filtered results:', vectorError)
        } else {
          // Merge and deduplicate results from both filters
          const preFilterIds = new Set(filteredDictionary.map((item: DictionaryEntry) => item.id))
          const vectorFilterIds = new Set(vectorFiltered.map((item: DictionaryEntry) => item.id))
          
          // Take union of both sets, prioritizing higher similarity scores
          const mergedResults = [
            ...filteredDictionary.filter((item: DictionaryEntry) => vectorFilterIds.has(item.id)),
            ...vectorFiltered.filter((item: DictionaryEntry) => !preFilterIds.has(item.id))
          ]
          
          filteredDictionary = mergedResults
        }
      } catch (embeddingError) {
        console.warn('Embedding generation failed, using pre-filtered results:', embeddingError)
      }
    } else if (filteredDictionary.length >= 1000) {
      // If too many pre-filtered entries, just use vector search directly
      try {
        const inputEmbedding = await createEmbedding(text)
        const { data: vectorFiltered } = await supabase
          .rpc('get_vector_similar_phrases', {
            query_embedding: JSON.stringify(inputEmbedding),
            similarity_threshold: 0.75,
            org_id: organizationId
          })
        
        if (vectorFiltered) {
          filteredDictionary = vectorFiltered
        }
      } catch (embeddingError) {
        console.warn('Vector search failed, truncating pre-filtered results:', embeddingError)
        filteredDictionary = filteredDictionary.slice(0, 100)
      }
    }

    // Step 3: Optimized LLM processing with improved system prompt
    const systemPrompt = `あなたは薬機法（医薬品医療機器等法）の専門家です。テキストを効率的に分析し、違反表現を検出して安全な表現に修正してください。

### 主要な違反パターン：
1. **医薬品的効果効能**: 「治る」「効く」「改善」「予防」等の医療効果表現
2. **身体の構造機能への影響**: 「血圧が下がる」「コレステロール値を下げる」等
3. **疾患名の治療効果**: 「がんが治る」「糖尿病が改善」等の疾患治療表現
4. **化粧品範囲逸脱**: 「シワが消える」「ニキビが治る」等の医薬品的効果
5. **誇大・断定表現**: 「必ず」「100%」「奇跡の」等の保証表現

### 修正方針：
- 医薬品的効果→一般的な表現（「サポート」「維持」「バランス」等）
- 治療効果→体感表現（「すっきり」「爽快」等）
- 断定表現→推量表現（「期待できる」「と言われる」等）
- 疾患名→削除または一般的な健康状態表現

### 分析効率化：
- 提供された辞書の違反パターンを優先的にチェック
- 文脈を考慮した適切な修正提案
- 過度な修正は避け、自然な文章を維持

提供された辞書を参考に、違反箇所を特定し修正してください。`

    let result: {
      modified: string
      violations: Array<{
        start: number
        end: number
        reason: string
        dictionaryId?: number
      }>
    }

    if (isUsingLMStudio()) {
      // LM Studio: プレーンテキスト応答を使用
      const plainTextPrompt = `${systemPrompt}

### 応答形式：
以下のJSON形式で厳密に応答してください。他のテキストは含めないでください：

{
  "modified": "修正されたテキスト",
  "violations": [
    {
      "start": 開始位置の数値,
      "end": 終了位置の数値,
      "reason": "違反理由"
    }
  ]
}

違反が見つからない場合は、violationsを空配列[]にしてください。JSONのみを返してください。`

      const llmResponse = await createChatCompletion({
        messages: [
          { role: 'system', content: plainTextPrompt },
          {
            role: 'user',
            content: `以下のテキストをチェックしてください：\n\n${text}\n\n${filteredDictionary.length > 0 ? `参考辞書データ：\n${JSON.stringify(filteredDictionary.slice(0, 50))}` : '辞書データ：なし'}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })

      interface LLMResponse {
        choices?: Array<{
          message?: {
            content?: string
          }
        }>
      }
      
      const responseContent = (llmResponse as LLMResponse).choices?.[0]?.message?.content
      if (!responseContent) {
        throw new Error('LM Studio did not return content')
      }

      // Extract JSON from response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('LM Studio response:', responseContent)
        throw new Error('No JSON found in LM Studio response')
      }

      try {
        const parsed = JSON.parse(jsonMatch[0])
        
        // Validate required fields
        if (typeof parsed.modified !== 'string') {
          throw new Error('Invalid modified field in LM Studio response')
        }
        if (!Array.isArray(parsed.violations)) {
          throw new Error('Invalid violations field in LM Studio response')
        }

        result = parsed
      } catch (parseError) {
        console.error('Failed to parse LM Studio JSON:', jsonMatch[0])
        throw new Error(`Failed to parse LM Studio response: ${parseError}`)
      }
    } else {
      // OpenAI: Function calling を使用
      const llmResponse = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `以下のテキストをチェックしてください：\n\n${text}\n\n${filteredDictionary.length > 0 ? `参考辞書データ：\n${JSON.stringify(filteredDictionary.slice(0, 50))}` : '辞書データ：なし'}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        tools: [
          {
            type: 'function',
            function: {
              name: 'submit_check_result',
              description: '薬機法チェックの結果を提出します',
              parameters: {
                type: 'object',
                properties: {
                  modified: {
                    type: 'string',
                    description: '修正されたテキスト'
                  },
                  violations: {
                    type: 'array',
                    description: '検出された違反のリスト',
                    items: {
                      type: 'object',
                      properties: {
                        start: { type: 'number', description: '違反箇所の開始位置' },
                        end: { type: 'number', description: '違反箇所の終了位置' },
                        reason: { type: 'string', description: '違反理由' },
                        dictionaryId: { type: 'number', description: '対応する辞書エントリのID（任意）' }
                      },
                      required: ['start', 'end', 'reason']
                    }
                  }
                },
                required: ['modified', 'violations']
              }
            }
          }
        ]
      })

      interface OpenAIResponse {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{
              function?: {
                name?: string
                arguments?: string
              }
            }>
          }
        }>
      }
      
      const toolCall = (llmResponse as OpenAIResponse).choices?.[0]?.message?.tool_calls?.[0]
      if (!toolCall || toolCall.function?.name !== 'submit_check_result') {
        throw new Error('OpenAI did not return expected function call')
      }

      try {
        result = JSON.parse(toolCall.function?.arguments ?? '{}')
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI function arguments: ${parseError}`)
      }
    }

    // Store violations in database
    const violationsToInsert = result.violations.map((violation: ViolationData) => ({
      check_id: checkId,
      start_pos: violation.start,
      end_pos: violation.end,
      reason: violation.reason,
      dictionary_id: violation.dictionaryId ?? null
    }))

    if (violationsToInsert.length > 0) {
      const { error: violationsError } = await supabase
        .from('violations')
        .insert(violationsToInsert)

      if (violationsError) {
        console.error(`[CHECK] Failed to insert violations for check ${checkId}:`, violationsError)
        // Continue anyway, don't fail the entire process
      }
    }

    // Update check with final results
    const { error: finalUpdateError } = await supabase
      .from('checks')
      .update({
        status: 'completed',
        modified_text: result.modified,
        violation_count: result.violations.length
      })
      .eq('id', checkId)

    if (finalUpdateError) {
      console.error(`[CHECK] Failed to update final results for check ${checkId}:`, finalUpdateError)
      throw new Error(`Failed to update final results: ${finalUpdateError.message}`)
    }

    console.log(`[CHECK] Successfully completed check ${checkId} with ${result.violations.length} violations`)
  } catch (error) {
    console.error(`[CHECK] Error in performActualCheck for ID ${checkId}:`, error)
    throw error // Re-throw to be handled by processCheck
  }
}