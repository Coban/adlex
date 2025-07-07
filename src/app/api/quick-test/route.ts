import { NextRequest, NextResponse } from 'next/server'

import { createEmbedding, createChatCompletion } from '@/lib/ai-client'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    console.log('=== Quick AI Test ===')
    console.log('Input text:', text)
    
    // Quick embedding test
    console.log('Testing embedding...')
    const embedding = await createEmbedding(text)
    console.log('✅ Embedding success, length:', embedding.length)
    
    // Quick chat test
    console.log('Testing chat...')
    const chatResponse = await createChatCompletion({
      messages: [
        { role: 'user', content: 'Say hello briefly' }
      ],
      temperature: 0.5
    })
    
    const responseContent = chatResponse.choices?.[0]?.message?.content
    console.log('✅ Chat success, response:', responseContent)
    
    return NextResponse.json({
      success: true,
      embedding: { length: embedding.length },
      chat: { response: responseContent },
      message: 'LM Studio AI features working correctly!'
    })
    
  } catch (error) {
    console.error('❌ Quick test failed:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
