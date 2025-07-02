import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    console.log('=== LM Studio Embedding Debug ===')
    console.log('Input text:', text)
    
    // LM Studio embedding APIを直接テスト
    const embeddingResponse = await fetch('http://127.0.0.1:1234/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: 'text-embedding-nomic-embed-text-v1.5',
        input: text
      })
    })
    
    console.log('Response status:', embeddingResponse.status)
    console.log('Response headers:', Object.fromEntries(embeddingResponse.headers.entries()))
    
    const responseText = await embeddingResponse.text()
    console.log('Raw response text:', responseText)
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
      console.log('Parsed response:', responseData)
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError)
      return NextResponse.json({
        error: 'Invalid JSON response',
        rawResponse: responseText,
        status: embeddingResponse.status
      })
    }
    
    return NextResponse.json({
      success: true,
      responseStatus: embeddingResponse.status,
      responseData,
      hasData: !!responseData.data,
      dataLength: responseData.data?.length,
      hasEmbedding: responseData.data?.[0]?.embedding ? 'yes' : 'no',
      embeddingLength: responseData.data?.[0]?.embedding?.length
    })
    
  } catch (error) {
    console.error('LM Studio debug error:', error)
    return NextResponse.json({
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
