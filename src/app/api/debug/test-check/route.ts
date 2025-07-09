import { NextRequest, NextResponse } from 'next/server'

import { createChatCompletion, isUsingLMStudio } from '@/lib/ai-client'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    console.log(`[DEBUG] Testing AI with text: "${text}"`)
    console.log(`[DEBUG] Using LM Studio: ${isUsingLMStudio()}`)

    const systemPrompt = `あなたは薬機法の専門家です。以下のJSON形式で厳密に応答してください：

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

違反が見つからない場合は、violationsを空配列[]にしてください。`

    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `以下のテキストをチェックしてください：\n\n${text}` }
      ],
      temperature: 0.1,
      max_tokens: 1000
    })

    console.log(`[DEBUG] AI response received:`, {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length,
      hasContent: !!response.choices?.[0]?.message?.content
    })

    const responseContent = response.choices?.[0]?.message?.content
    if (!responseContent) {
      return NextResponse.json({ error: 'No response content' }, { status: 500 })
    }

    console.log(`[DEBUG] Raw response content:`, responseContent)

    // Try to parse JSON response
    try {
      let jsonContent = responseContent
      
      // Remove markdown code blocks if present
      const codeBlockMatch = responseContent.match(/```json\n([\s\S]*?)\n```/)
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1]
      } else {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonContent = jsonMatch[0]
        }
      }

      const parsedResult = JSON.parse(jsonContent)
      console.log(`[DEBUG] Parsed result:`, parsedResult)

      return NextResponse.json({
        success: true,
        isUsingLMStudio: isUsingLMStudio(),
        rawResponse: responseContent,
        parsedResult
      })
    } catch (parseError) {
      console.error(`[DEBUG] Failed to parse response:`, parseError)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        rawResponse: responseContent,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error(`[DEBUG] Error in test-check:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
