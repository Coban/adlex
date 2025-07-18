import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    const { text } = body
    
    console.log('=== LM Studio JSON Schema Test ===')
    console.log('Input text:', text)
    console.log('Model:', process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b')
    
    const testResults = []
    
    // 1. JSON Schema構造化出力をテスト
    try {
      console.log('Testing JSON Schema structured output...')
      const jsonSchemaResponse = await fetch(process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY ?? 'lm-studio'}`
        },
        body: JSON.stringify({
          model: process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b',
          messages: [
            { role: 'system', content: 'あなたは薬機法チェックツールです。' },
            { role: 'user', content: `以下のテキストをチェックしてください：${text}` }
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "test_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  result: { type: "string" },
                  hasViolations: { type: "boolean" }
                },
                required: ["result", "hasViolations"]
              }
            }
          }
        })
      })
      
      console.log('JSON Schema response status:', jsonSchemaResponse.status)
      const jsonSchemaData = await jsonSchemaResponse.json()
      console.log('JSON Schema response:', jsonSchemaData)
      
      testResults.push({
        method: 'JSON Schema',
        success: jsonSchemaResponse.ok,
        status: jsonSchemaResponse.status,
        hasContent: !!jsonSchemaData.choices?.[0]?.message?.content,
        content: jsonSchemaData.choices?.[0]?.message?.content,
        error: jsonSchemaResponse.ok ? null : jsonSchemaData
      })
      
    } catch (jsonSchemaError) {
      console.error('JSON Schema test failed:', jsonSchemaError)
      testResults.push({
        method: 'JSON Schema',
        success: false,
        error: jsonSchemaError instanceof Error ? jsonSchemaError.message : 'Unknown error'
      })
    }
    
    // 2. 従来の方法をテスト
    try {
      console.log('Testing traditional method...')
      const traditionalResponse = await fetch(process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY ?? 'lm-studio'}`
        },
        body: JSON.stringify({
          model: process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b',
          messages: [
            { role: 'system', content: 'あなたは薬機法チェックツールです。JSON形式で回答してください。' },
            { role: 'user', content: `以下のテキストをチェックしてください：${text}` }
          ],
          temperature: 0.1,
          max_tokens: 500
        })
      })
      
      console.log('Traditional response status:', traditionalResponse.status)
      const traditionalData = await traditionalResponse.json()
      console.log('Traditional response:', traditionalData)
      
      testResults.push({
        method: 'Traditional',
        success: traditionalResponse.ok,
        status: traditionalResponse.status,
        hasContent: !!traditionalData.choices?.[0]?.message?.content,
        content: traditionalData.choices?.[0]?.message?.content,
        error: traditionalResponse.ok ? null : traditionalData
      })
      
    } catch (traditionalError) {
      console.error('Traditional test failed:', traditionalError)
      testResults.push({
        method: 'Traditional',
        success: false,
        error: traditionalError instanceof Error ? traditionalError.message : 'Unknown error'
      })
    }
    
    return NextResponse.json({
      success: true,
      config: {
        model: process.env.LM_STUDIO_CHAT_MODEL ?? 'google/gemma-3-12b',
        baseUrl: process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234',
        apiKey: process.env.LM_STUDIO_API_KEY ? 'set' : 'not set'
      },
      testResults,
      inputText: text
    })
    
  } catch (error) {
    console.error('Debug test error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 