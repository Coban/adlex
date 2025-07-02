import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Direct LM Studio test
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: 'gemma-3-27b-it',
        messages: [
          {
            role: 'system',
            content: 'あなたは薬機法の専門家です。以下のJSON形式で必ず応答してください：{"modified": "修正されたテキスト", "violations": []}'
          },
          {
            role: 'user',
            content: 'この商品は癌を治します。をチェックしてください。'
          }
        ],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    console.log('LM Studio direct test response:', content)

    return NextResponse.json({
      success: true,
      status: response.status,
      content: content?.substring(0, 500),
      fullResponse: data
    })

  } catch (error) {
    console.error('Direct LM Studio test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
