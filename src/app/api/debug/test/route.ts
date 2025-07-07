import { NextRequest, NextResponse } from 'next/server'

import { createEmbedding, createChatCompletion } from '@/lib/ai-client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Debug API Test Started ===')
    
    const body = await request.json()
    const { test } = body
    
    console.log('Test type:', test)
    
    if (test === 'embedding') {
      console.log('Testing embedding generation...')
      const embedding = await createEmbedding('テストテキスト')
      console.log('Embedding generated successfully, length:', embedding.length)
      return NextResponse.json({ 
        success: true, 
        message: 'Embedding test successful',
        embeddingLength: embedding.length
      })
    }
    
    if (test === 'chat') {
      console.log('Testing chat completion...')
      const response = await createChatCompletion({
        messages: [
          { role: 'system', content: 'あなたは薬機法の専門家です。' },
          { role: 'user', content: 'このテキストをチェックしてください：「このサプリメントは病気を治します」' }
        ]
      })
      console.log('Chat completion successful')
      return NextResponse.json({ 
        success: true, 
        message: 'Chat completion test successful',
        response: response.choices[0]?.message?.content || 'No content'
      })
    }
    
    if (test === 'supabase') {
      console.log('Testing Supabase connection...')
      const supabase = await createClient()
      
      // Test connection
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)
        
      if (error) {
        console.error('Supabase test error:', error)
        return NextResponse.json({ 
          success: false, 
          message: 'Supabase test failed',
          error: error.message
        })
      }
      
      console.log('Supabase test successful, data:', data)
      return NextResponse.json({ 
        success: true, 
        message: 'Supabase test successful',
        data
      })
    }
    
    return NextResponse.json({ error: 'Invalid test type' }, { status: 400 })
    
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
