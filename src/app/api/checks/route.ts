import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user session - try both cookie and header authentication
    let user, authError
    
    // First try getting user from cookies (SSR approach)
    const authResult = await supabase.auth.getUser()
    user = authResult.data.user
    authError = authResult.error
    
    // If no user found from cookies, try Authorization header
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        console.log('Attempting Bearer token authentication...')
        
        try {
          // Use service role client to verify token
          const { createClient: createServiceClient } = await import('@supabase/supabase-js')
          const supabaseService = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          
          const { data: { user: tokenUser }, error: tokenError } = await supabaseService.auth.getUser(token)
          if (tokenUser) {
            user = tokenUser
            authError = tokenError
            console.log('Bearer token authentication successful:', tokenUser.email)
          }
        } catch (error) {
          console.error('Bearer token authentication failed:', error)
        }
      }
    }
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('User ID:', user.id)
    console.log('User email:', user.email)
    console.log('User metadata:', user.user_metadata)

    // Get user's organization with a safer query method
    const { data: initialUserData, error: userError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    console.log('User data query result:', initialUserData, 'Error:', userError)

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: `User data error: ${userError.message}` }, { status: 500 })
    }

    let userData = initialUserData

    // If user not found by ID, check if there's an existing user with the same email
    if (!userData) {
      console.log('Checking for user by email...')
      const { data: emailUserData, error: emailError } = await supabase
        .from('users')
        .select('id, email, organization_id, role')
        .eq('email', user.email ?? '')
        .maybeSingle()
      
      console.log('Email-based user query result:', emailUserData, 'Error:', emailError)
      
      if (emailUserData) {
        // User exists with this email but different ID - this is a UUID mismatch
        // For now, use the existing user data but log the mismatch
        console.log('UUID mismatch detected - using existing user data')
        console.log('Auth UUID:', user.id)
        console.log('DB UUID:', emailUserData.id)
        console.log('Email user data:', {
          id: emailUserData.id,
          email: emailUserData.email,
          organization_id: emailUserData.organization_id,
          role: emailUserData.role
        })
        userData = emailUserData
      }
    }

    if (!userData) {
      // User doesn't exist in users table, create one
      console.log('User not found in users table, creating...')
      
      // Get default organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('name', 'サンプル組織')
        .single()
      
      if (!orgData) {
        return NextResponse.json({ error: 'Default organization not found' }, { status: 500 })
      }
      
      // Create user
      const { data: newUserData, error: createUserError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email ?? 'unknown@example.com',
          organization_id: orgData.id,
          role: 'user'
        })
        .select('id, email, organization_id, role')
        .single()
      
      if (createUserError) {
        console.error('Error creating user:', createUserError)
        return NextResponse.json({ error: `Failed to create user: ${createUserError.message}` }, { status: 500 })
      }
      
      // Use the newly created user data
      userData = newUserData
    }

    console.log('Final userData check:', {
      hasUserData: !!userData,
      userId: userData?.id,
      email: userData?.email,
      organizationId: userData?.organization_id,
      role: userData?.role
    })

    if (!userData?.organization_id) {
      console.error('User has no organization_id')
      console.error('Current userData:', userData)
      return NextResponse.json({ error: 'User not assigned to organization' }, { status: 400 })
    }

    // Get organization data separately
    const { data: organizationData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, used_checks, max_checks')
      .eq('id', userData.organization_id)
      .single()

    console.log('Organization data:', organizationData, 'Error:', orgError)

    if (orgError || !organizationData) {
      console.error('Error fetching organization data:', orgError)
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Check usage limits
    if ((organizationData.used_checks ?? 0) >= (organizationData.max_checks ?? 0)) {
      return NextResponse.json({ error: 'Usage limit exceeded' }, { status: 403 })
    }

    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 10000) {
      return NextResponse.json({ error: 'Text too long (max 10,000 characters)' }, { status: 400 })
    }

    // Create check record
    const { data: checkData, error: checkError } = await supabase
      .from('checks')
      .insert({
        user_id: userData.id, // Use the userData.id (which might be different from user.id)
        organization_id: userData.organization_id,
        original_text: text,
        status: 'pending'
      })
      .select()
      .single()

    if (checkError) {
      console.error('Error creating check:', checkError)
      return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
    }

    // Start background processing with timeout protection
    const processingPromise = processCheck(checkData.id, text, userData.organization_id)
    
    // Don't await - let it run in background, but set up timeout protection
    processingPromise.catch((error) => {
      console.error('Background processing failed for check:', checkData.id, error)
    })

    return NextResponse.json({
      id: checkData.id,
      status: 'pending'
    })

  } catch (error) {
    console.error('Error in checks API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processCheck(checkId: number, text: string, organizationId: number) {
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
    console.error('Error processing check:', error)

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
    await supabase
      .from('checks')
      .update({ 
        status: 'failed',
        error_message: errorMessage
      })
      .eq('id', checkId)
  }
}

async function performActualCheck(checkId: number, text: string, organizationId: number, supabase: SupabaseClient<Database>) {
  try {
    // Update status to processing
    await supabase
      .from('checks')
      .update({ status: 'processing' })
      .eq('id', checkId)

    // Step 1: Pre-filter using pg_trgm similarity (≥0.3)
    // This is the fastest filter to reduce the dataset
    const { data: preFilteredDictionary, error: preFilterError } = await supabase
      .rpc('get_similar_phrases', {
        input_text: text,
        similarity_threshold: 0.3,
        org_id: organizationId
      })

    if (preFilterError) {
      console.warn('Pre-filter failed, continuing without pre-filtering:', preFilterError)
    }

    let filteredDictionary = preFilteredDictionary ?? []
    console.log('Pre-filter results:', filteredDictionary.length, 'entries found')

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
          console.log('Vector similarity filtering successful, merged to:', filteredDictionary.length, 'entries')
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
          console.log('Using vector search only due to large pre-filter set:', filteredDictionary.length, 'entries')
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
以下のJSON形式で厳密に応答してください：

{
  "modified": "修正されたテキスト",
  "violations": [
    {
      "start": 開始位置の数値,
      "end": 終了位置の数値,
      "reason": "違反理由",
      "dictionaryId": 辞書ID（該当する場合）
    }
  ]
}

違反が見つからない場合は、violationsを空配列[]にしてください。`

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

      const responseContent = llmResponse.choices?.[0]?.message?.content
      if (!responseContent) {
        throw new Error('LM Studio did not return content')
      }

      try {
        // JSONレスポンスをパース
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('No JSON found in LM Studio response')
        }
        
        result = JSON.parse(jsonMatch[0])
        
        // 必要なフィールドの検証
        if (typeof result.modified !== 'string') {
          throw new Error('Invalid modified field in LM Studio response')
        }
        if (!Array.isArray(result.violations)) {
          throw new Error('Invalid violations field in LM Studio response')
        }
        
        console.log('LM Studio response parsed successfully:', {
          hasModified: !!result.modified,
          violationsCount: result.violations.length
        })
      } catch (parseError) {
        console.error('Failed to parse LM Studio response:', parseError)
        console.error('Response content:', responseContent)
        
        // フォールバック: シンプルな応答を作成
        result = {
          modified: text, // 元のテキストをそのまま返す
          violations: []
        }
        console.log('Using fallback response for LM Studio')
      }
    } else {
      // OpenAI: Function calling を使用
      const functionSchema = {
        name: "apply_yakukiho_rules",
        description: "Apply pharmaceutical law rules to check and modify text efficiently",
        parameters: {
          type: "object",
          properties: {
            modified: {
              type: "string",
              description: "The modified text that complies with pharmaceutical laws"
            },
            violations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  start: { type: "integer", description: "Start position of violation" },
                  end: { type: "integer", description: "End position of violation" },
                  reason: { type: "string", description: "Reason for violation" },
                  dictionaryId: {
                    type: "integer",
                    description: "ID of dictionary entry that triggered this violation (optional)"
                  }
                },
                required: ["start", "end", "reason"]
              }
            }
          },
          required: ["modified", "violations"]
        }
      }

      const llmResponse = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `以下のテキストをチェックしてください：\n\n${text}\n\n${filteredDictionary.length > 0 ? `参考辞書データ：\n${JSON.stringify(filteredDictionary.slice(0, 50))}` : '辞書データ：なし'}`
          }
        ],
        tools: [{ type: 'function', function: functionSchema }],
        tool_choice: { type: 'function', function: { name: 'apply_yakukiho_rules' } },
        temperature: 0.1,
        max_tokens: 2000
      })

      const toolCall = llmResponse.choices?.[0]?.message?.tool_calls?.[0]
      if (!toolCall || toolCall.function.name !== 'apply_yakukiho_rules') {
        console.error('Invalid tool call:', {
          toolCall,
          hasToolCall: !!toolCall,
          functionName: toolCall?.function?.name
        })
        throw new Error('OpenAI did not return expected function call')
      }

      result = JSON.parse(toolCall.function.arguments)
    }

    // Save violations
    if (result.violations && result.violations.length > 0) {
      const violationsToInsert = result.violations.map((v: ViolationData) => ({
        check_id: checkId,
        start_pos: v.start,
        end_pos: v.end,
        reason: v.reason,
        dictionary_id: v.dictionaryId ?? null
      }))

      await supabase
        .from('violations')
        .insert(violationsToInsert)
    }

    // Update check with results
    await supabase
      .from('checks')
      .update({
        modified_text: result.modified,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', checkId)

    // Update organization usage count
    await supabase
      .rpc('increment_organization_usage', { org_id: organizationId })

  } catch (error) {
    console.error('Error in performActualCheck:', error)
    throw error // Re-throw to be handled by processCheck
  }
}
