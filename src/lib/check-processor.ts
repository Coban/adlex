import { SupabaseClient } from '@supabase/supabase-js'

import { createChatCompletion, createEmbedding, isUsingLMStudio, getAIClientInfo } from '@/lib/ai-client'
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

// Helper function to manually extract fields from malformed responses
function extractFieldsManually(responseContent: string): {
  modified: string
  violations: Array<{
    start: number
    end: number
    reason: string
    dictionaryId?: number
  }>
} | null {
  try {
    // Extract modified text
    const modifiedMatch = responseContent.match(/"modified"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/)
    const modified = modifiedMatch ? modifiedMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : null
    
    // Extract violations array
    const violationsMatch = responseContent.match(/"violations"\s*:\s*(\[[\s\S]*?\])/)
    let violations = []
    
    if (violationsMatch) {
      try {
        violations = JSON.parse(violationsMatch[1])
      } catch {
        // If violations array parsing fails, try to extract individual violations
        const violationPattern = /\{\s*"start"\s*:\s*(\d+)\s*,\s*"end"\s*:\s*(\d+)\s*,\s*"reason"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/g
        let match
        while ((match = violationPattern.exec(responseContent)) !== null) {
          violations.push({
            start: parseInt(match[1]),
            end: parseInt(match[2]),
            reason: match[3].replace(/\\"/g, '"').replace(/\\n/g, '\n')
          })
        }
      }
    }
    
    if (modified !== null) {
      return {
        modified,
        violations: Array.isArray(violations) ? violations : []
      }
    }
    
    return null
  } catch (error) {
    console.error('Manual field extraction failed:', error)
    return null
  }
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
        errorMessage = `AI分析エラー: テキスト処理に失敗しました - ${error.message}`
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
    // Log AI configuration for debugging
    const aiInfo = getAIClientInfo()
    console.log(`[CHECK ${checkId}] AI Configuration:`, aiInfo)
    
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

### 重要: 応答形式の指示
以下のJSON形式でのみ応答してください。
- JSONの前後に説明文や追加テキストを一切含めないでください
- コードブロックも使用しないでください
- JSONオブジェクトのみを返してください

必須フォーマット:
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

注意事項:
- 違反が見つからない場合は、violations: [] として空配列を設定
- modified フィールドは必須 (修正不要の場合は元のテキストをそのまま設定)
- JSONの構文エラーがないよう注意
- レスポンスはJSONオブジェクトで開始し、JSONオブジェクトで終了してください`

      console.log(`[CHECK ${checkId}] Calling LM Studio for text analysis...`)
      
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
      
      console.log(`[CHECK ${checkId}] LM Studio response received successfully`)

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

      // Extract JSON from response with improved parsing
      let jsonContent = ''
      
      try {
        // Try different approaches to extract JSON
        
        // 1. Look for JSON in code blocks first
        const codeBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (codeBlockMatch) {
          jsonContent = codeBlockMatch[1].trim()
        } else {
          // 2. Find the first complete JSON object
          const startIndex = responseContent.indexOf('{')
          if (startIndex === -1) {
            throw new Error('No JSON object found in response')
          }
          
          // Find matching closing brace
          let braceCount = 0
          let endIndex = -1
          for (let i = startIndex; i < responseContent.length; i++) {
            if (responseContent[i] === '{') {
              braceCount++
            } else if (responseContent[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                endIndex = i
                break
              }
            }
          }
          
          if (endIndex === -1) {
            throw new Error('No complete JSON object found in response')
          }
          
          jsonContent = responseContent.substring(startIndex, endIndex + 1)
        }
        
        // Clean up the JSON content
        jsonContent = jsonContent.trim()
        
        console.log('Extracted JSON content:', jsonContent)
        
        // Parse the JSON
        const parsed = JSON.parse(jsonContent)
        
        // Validate required fields
        if (typeof parsed.modified !== 'string') {
          throw new Error('Invalid modified field in LM Studio response')
        }
        if (!Array.isArray(parsed.violations)) {
          throw new Error('Invalid violations field in LM Studio response')
        }

        result = parsed
        
      } catch (parseError) {
        console.error('Failed to parse LM Studio response:')
        console.error('Raw response:', responseContent)
        console.error('Extracted JSON:', jsonContent)
        console.error('Parse error:', parseError)
        
        // Enhanced fallback with manual field extraction
        try {
          const fallbackResult = extractFieldsManually(responseContent)
          if (fallbackResult) {
            console.log('Using fallback parsing result:', fallbackResult)
            result = fallbackResult
          } else {
            // Ultimate fallback: return safe minimal result
            console.warn('All parsing methods failed, using safe fallback')
            result = {
              modified: text, // Return original text unchanged
              violations: [{
                start: 0,
                end: Math.min(text.length, 10),
                reason: "LM Studio応答の解析に失敗しました。手動で確認してください。",
                dictionaryId: undefined
              }]
            }
          }
        } catch {
          // Ultimate fallback: return safe minimal result
          console.warn('Fallback parsing failed, using ultimate safe fallback')
          result = {
            modified: text, // Return original text unchanged
            violations: [{
              start: 0,
              end: Math.min(text.length, 10),
              reason: "LM Studio応答の解析に失敗しました。手動で確認してください。",
              dictionaryId: undefined
            }]
          }
        }
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

    // Validate result consistency: if text was modified, there should be violations
    if (result.modified !== text && result.violations.length === 0) {
      console.warn(`[CHECK ${checkId}] Text was modified but no violations reported. Adding inferred violation.`)
      
      // Find the differences between original and modified text
      const originalWords = text.split('')
      const modifiedWords = result.modified.split('')
      
      // Simple diff to find the first change
      let startPos = 0
      let endPos = text.length
      
      // Find start of difference
      while (startPos < Math.min(originalWords.length, modifiedWords.length) && 
             originalWords[startPos] === modifiedWords[startPos]) {
        startPos++
      }
      
      // Find end of difference (working backwards)
      let originalEnd = originalWords.length - 1
      let modifiedEnd = modifiedWords.length - 1
      while (originalEnd >= startPos && modifiedEnd >= 0 && 
             originalWords[originalEnd] === modifiedWords[modifiedEnd]) {
        originalEnd--
        modifiedEnd--
      }
      endPos = originalEnd + 1
      
      // Ensure we have a valid range
      if (startPos >= endPos) {
        startPos = 0
        endPos = Math.min(10, text.length) // Default to first 10 characters
      }
      
      // Add an inferred violation
      result.violations.push({
        start: startPos,
        end: endPos,
        reason: `薬機法違反の可能性: 「${text.substring(startPos, endPos)}」は適切でない表現として修正されました。`,
        dictionaryId: undefined
      })
      
      console.log(`[CHECK ${checkId}] Added inferred violation at positions ${startPos}-${endPos}`)
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
        completed_at: new Date().toISOString()
      })
      .eq('id', checkId)

    if (finalUpdateError) {
      console.error(`[CHECK] Failed to update final results for check ${checkId}:`, finalUpdateError)
      throw new Error(`Failed to update final results: ${finalUpdateError.message}`)
    }

    // Update organization usage count (skip for testing)
    if (!((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && process.env.SKIP_AUTH === 'true')) {
      // Get current usage count and increment it
      const { data: org, error: fetchError } = await supabase
        .from('organizations')
        .select('used_checks')
        .eq('id', organizationId)
        .single()
      
      if (!fetchError && org) {
        const newUsedChecks = (org.used_checks ?? 0) + 1
        const { error: usageError } = await supabase
          .from('organizations')
          .update({ used_checks: newUsedChecks })
          .eq('id', organizationId)
        
        if (usageError) {
          console.error(`[CHECK] Failed to update organization usage for org ${organizationId}:`, usageError)
          // Don't throw error - this is not critical for the check itself
        }
      } else if (fetchError) {
        console.error(`[CHECK] Failed to fetch organization usage for org ${organizationId}:`, fetchError)
      }
    }

    console.log(`[CHECK] Successfully completed check ${checkId} with ${result.violations.length} violations`)
  } catch (error) {
    console.error(`[CHECK] Error in performActualCheck for ID ${checkId}:`, error)
    throw error // Re-throw to be handled by processCheck
  }
}