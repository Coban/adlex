import { NextRequest, NextResponse } from 'next/server'

import { createChatCompletion, createEmbedding } from '@/lib/ai-client'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    console.log('=== Simple Check Test Started ===')
    console.log('Input text:', text)

    // Test embedding first
    console.log('Testing embedding...')
    let embedding: number[]
    try {
      embedding = await createEmbedding(text)
      console.log('Embedding successful, length:', embedding.length)
    } catch (embeddingError) {
      console.error('Embedding failed:', embeddingError)
      return NextResponse.json({ 
        error: 'Embedding failed', 
        details: embeddingError instanceof Error ? embeddingError.message : 'Unknown error' 
      }, { status: 500 })
    }

    // Test chat completion
    console.log('Testing chat completion...')
    try {
      const systemPrompt = "You are a helpful assistant that checks text for compliance with pharmaceutical laws. Please respond with a simple text analysis."

      const llmResponse = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Check this text: ${text}` }
        ]
        // Note: LM Studio may not support tools, so we omit them for now
      })

      console.log('Chat completion response structure:', {
        hasChoices: !!llmResponse.choices,
        choicesLength: llmResponse.choices?.length,
        firstChoiceContent: llmResponse.choices?.[0]?.message?.content
      })

      const responseContent = llmResponse.choices?.[0]?.message?.content
      if (!responseContent) {
        console.error('No content found in response')
        return NextResponse.json({ 
          error: 'No response content found', 
          responseStructure: JSON.stringify(llmResponse, null, 2) 
        }, { status: 500 })
      }

      console.log('Chat completion successful, response:', responseContent)

      return NextResponse.json({
        success: true,
        embedding: {
          length: embedding.length,
          sampleValues: embedding.slice(0, 5)
        },
        chatResponse: {
          content: responseContent
        },
        debug: {
          embeddingWorked: true,
          chatCompletionWorked: true,
          lmStudioUsed: true
        }
      })

    } catch (chatError) {
      console.error('Chat completion failed:', chatError)
      return NextResponse.json({ 
        error: 'Chat completion failed', 
        details: chatError instanceof Error ? chatError.message : 'Unknown error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Simple check test failed:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
