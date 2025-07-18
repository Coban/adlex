import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('=== LM Studio Simple Connection Test ===')
    
    const config = {
      baseUrl: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234',
      apiKey: process.env.LM_STUDIO_API_KEY ?? 'lm-studio',
      model: process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b'
    }
    
    console.log('LM Studio設定:', config)
    
    // 1. まずヘルスチェック
    try {
      const healthResponse = await fetch(`${config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      })
      
      console.log('Health check status:', healthResponse.status)
      if (healthResponse.ok) {
        const models = await healthResponse.json()
        console.log('Available models:', models)
      }
    } catch (healthError) {
      console.error('Health check failed:', healthError)
    }
    
    // 2. 最小限のチャット完了テスト
    const testResponse = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
        temperature: 0.1
      })
    })
    
    console.log('Test response status:', testResponse.status)
    console.log('Test response headers:', Object.fromEntries(testResponse.headers.entries()))
    
    const responseText = await testResponse.text()
    console.log('Test response raw text:', responseText)
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
      console.log('Test response parsed:', responseData)
    } catch (parseError) {
      console.error('Failed to parse test response:', parseError)
      return NextResponse.json({
        error: 'Failed to parse LM Studio response',
        config,
        responseStatus: testResponse.status,
        responseText,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      config,
      testResponse: {
        status: testResponse.status,
        ok: testResponse.ok,
        data: responseData,
        hasContent: !!responseData.choices?.[0]?.message?.content,
        content: responseData.choices?.[0]?.message?.content
      }
    })
    
  } catch (error) {
    console.error('LM Studio simple test error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    console.log('=== LM Studio Simple POST Test ===')
    console.log('Input text:', text)
    
    const config = {
      baseUrl: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234',
      apiKey: process.env.LM_STUDIO_API_KEY ?? 'lm-studio',
      model: process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b'
    }
    
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: text }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    })
    
    console.log('Response status:', response.status)
    const responseData = await response.json()
    console.log('Response data:', responseData)
    
    return NextResponse.json({
      success: response.ok,
      config,
      response: {
        status: response.status,
        data: responseData,
        hasContent: !!responseData.choices?.[0]?.message?.content,
        content: responseData.choices?.[0]?.message?.content
      }
    })
    
  } catch (error) {
    console.error('LM Studio simple POST test error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 