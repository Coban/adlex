import { NextResponse } from 'next/server'

import { createChatCompletion, isUsingLMStudio } from '@/lib/ai-client'

export async function GET() {
  try {
    console.log('LM Studio test endpoint called')
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      USE_LM_STUDIO: process.env.USE_LM_STUDIO,
      isUsingLMStudio: isUsingLMStudio()
    })

    const testText = "この商品は癌を治します。病気に効果があります。"
    
    if (isUsingLMStudio()) {
      // LM Studio test
      const plainTextPrompt = `あなたは薬機法の専門家です。以下のテキストをチェックして、JSON形式で応答してください：

{
  "modified": "修正されたテキスト",
  "violations": [
    {
      "start": 0,
      "end": 10,
      "reason": "違反理由"
    }
  ]
}

違反が見つからない場合は、violationsを空配列[]にしてください。`

      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: plainTextPrompt },
          { role: 'user', content: `チェックしてください：${testText}` }
        ],
        temperature: 0.1
      })

      console.log('LM Studio response:', {
        hasChoices: !!response.choices,
        content: response.choices?.[0]?.message?.content?.substring(0, 200)
      })

      return NextResponse.json({
        success: true,
        aiProvider: 'LM Studio',
        hasResponse: !!response.choices?.[0]?.message?.content,
        responsePreview: response.choices?.[0]?.message?.content?.substring(0, 200) + '...'
      })
    } else {
      return NextResponse.json({
        success: true,
        aiProvider: 'OpenAI (or other)',
        message: 'Not using LM Studio'
      })
    }

  } catch (error) {
    console.error('LM Studio test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      aiProvider: isUsingLMStudio() ? 'LM Studio' : 'OpenAI'
    }, { status: 500 })
  }
}
