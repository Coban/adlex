import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChatCompletion, createEmbedding, isUsingLMStudio } from '@/lib/ai-client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('User ID:', user.id)

    // Get user's organization with a safer query method
    const { data: initialUserData, error: userError } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('id', user.id)
      .maybeSingle()

    console.log('User data query result:', initialUserData, 'Error:', userError)

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: `User data error: ${userError.message}` }, { status: 500 })
    }

    let userData = initialUserData

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
          email: user.email || 'unknown@example.com',
          organization_id: orgData.id,
          role: 'user'
        })
        .select('id, organization_id')
        .single()
      
      if (createUserError) {
        console.error('Error creating user:', createUserError)
        return NextResponse.json({ error: `Failed to create user: ${createUserError.message}` }, { status: 500 })
      }
      
      // Use the newly created user data
      userData = newUserData
    }

    if (!userData?.organization_id) {
      console.error('User has no organization_id')
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
        user_id: user.id,
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

    // Start background processing
    processCheck(checkData.id, text, userData.organization_id)

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

  try {
    // Update status to processing
    await supabase
      .from('checks')
      .update({ status: 'processing' })
      .eq('id', checkId)

    // Step 1: Pre-filter using pg_trgm similarity (for reference, actual filtering done in step 2)
    // const { data: preFilteredDictionary } = await supabase
    //   .rpc('get_similar_phrases', {
    //     input_text: text,
    //     similarity_threshold: 0.3,
    //     org_id: organizationId
    //   })

    // Step 2: Semantic filtering using vector similarity (optional)
    let filteredDictionary = null
    
    try {
      // Get embeddings for input text
      const inputEmbedding = await createEmbedding(text)

      // Filter by vector similarity
      const { data } = await supabase
        .rpc('get_vector_similar_phrases', {
          query_embedding: JSON.stringify(inputEmbedding),
          similarity_threshold: 0.75, // cosine similarity > 0.75 (distance < 0.25)
          org_id: organizationId
        })
      
      filteredDictionary = data
      console.log('Vector similarity filtering successful, found entries:', data?.length || 0)
    } catch (embeddingError) {
      console.warn('Embedding generation failed, proceeding without vector filtering:', embeddingError)
      // Continue without embedding-based filtering
    }

    // Step 3: LLM processing
    const systemPrompt = `あなたは薬機法（医薬品医療機器等法）の専門家です。以下のルールに違反する表現を検出し、安全な表現に修正してください。

### 主要な違反パターン：
1. 医薬品や医療機器でない商品への医療効果の標榜
2. 化粧品への医薬品的効果の標榜
3. 健康食品への病気治療効果の標榜
4. 誇大な効果効能の表現
5. 安全性を保証する表現

### 修正方針：
- 具体的な効果効能は削除または一般的な表現に変更
- 「〜に効く」「治る」「治療」等は削除
- 体験談風の表現も適切に修正
- 薬機法に準拠した表現に変更

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
            content: `以下のテキストをチェックしてください：\n\n${text}\n\n辞書データ：\n${JSON.stringify(filteredDictionary || [])}`
          }
        ],
        temperature: 0.1
      })

      console.log('LM Studio LLM Response:', {
        hasChoices: !!llmResponse.choices,
        choicesLength: llmResponse.choices?.length,
        firstChoice: llmResponse.choices?.[0] ? {
          hasMessage: !!llmResponse.choices[0].message,
          content: llmResponse.choices[0].message?.content?.substring(0, 200) + '...'
        } : null
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
        description: "Apply pharmaceutical law rules to check and modify text",
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
            content: `以下のテキストをチェックしてください：\n\n${text}\n\n辞書データ：\n${JSON.stringify(filteredDictionary || [])}`
          }
        ],
        tools: [{ type: 'function', function: functionSchema }],
        tool_choice: { type: 'function', function: { name: 'apply_yakukiho_rules' } }
      })

      console.log('OpenAI LLM Response structure:', {
        hasChoices: !!llmResponse.choices,
        choicesLength: llmResponse.choices?.length,
        firstChoice: llmResponse.choices?.[0] ? {
          hasMessage: !!llmResponse.choices[0].message,
          messageKeys: llmResponse.choices[0].message ? Object.keys(llmResponse.choices[0].message) : [],
          hasToolCalls: !!llmResponse.choices[0].message?.tool_calls,
          toolCallsLength: llmResponse.choices[0].message?.tool_calls?.length
        } : null
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
      const violationsToInsert = result.violations.map((v: {
        start: number
        end: number
        reason: string
        dictionaryId?: number
      }) => ({
        check_id: checkId,
        start_pos: v.start,
        end_pos: v.end,
        reason: v.reason,
        dictionary_id: v.dictionaryId || null
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
    console.error('Error processing check:', error)

    // Get a more descriptive error message
    let errorMessage = 'チェック処理中にエラーが発生しました'
    if (error instanceof Error) {
      if (error.message.includes('Failed to create embedding')) {
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
