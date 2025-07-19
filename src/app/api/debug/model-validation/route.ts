import { NextResponse } from 'next/server'

import { validateModelConfiguration, getAIClientInfo } from '@/lib/ai-client'

export async function GET() {
  try {
    console.log('=== Model Configuration Validation ===')
    
    // Get comprehensive AI client information
    const aiInfo = getAIClientInfo()
    console.log('AI Client Info:', aiInfo)
    
    // Validate model configuration
    const validation = validateModelConfiguration()
    console.log('Validation Result:', validation)
    
    // Additional checks for LM Studio
    const additionalChecks = {
      hasValidChatModel: true,
      hasValidEmbeddingModel: true,
      environmentVariables: {
        LM_STUDIO_CHAT_MODEL: process.env.LM_STUDIO_CHAT_MODEL,
        LM_STUDIO_EMBEDDING_MODEL: process.env.LM_STUDIO_EMBEDDING_MODEL,
        LM_STUDIO_BASE_URL: process.env.LM_STUDIO_BASE_URL,
        USE_LM_STUDIO: process.env.USE_LM_STUDIO,
        NODE_ENV: process.env.NODE_ENV
      }
    }
    
    // Check if chat model looks like an embedding model
    const chatModel = aiInfo.currentChatModel
    if (chatModel.includes('embedding') || chatModel.includes('embed')) {
      additionalChecks.hasValidChatModel = false
    }
    
    // Check if embedding model looks like a chat model
    const embeddingModel = aiInfo.currentEmbeddingModel
    if (!embeddingModel.includes('embedding') && !embeddingModel.includes('embed')) {
      additionalChecks.hasValidEmbeddingModel = false
    }
    
    // Generate recommendations
    const recommendations = []
    
    if (!additionalChecks.hasValidChatModel) {
      recommendations.push('Set LM_STUDIO_CHAT_MODEL to a proper chat model like "microsoft/Phi-3-mini-4k-instruct-gguf" or "google/gemma-2-2b-it-gguf"')
    }
    
    if (!additionalChecks.hasValidEmbeddingModel) {
      recommendations.push('Set LM_STUDIO_EMBEDDING_MODEL to a proper embedding model like "text-embedding-nomic-embed-text-v1.5"')
    }
    
    if (aiInfo.isUsingLMStudio && !process.env.LM_STUDIO_BASE_URL) {
      recommendations.push('Set LM_STUDIO_BASE_URL (default: http://localhost:1234/v1)')
    }
    
    // Test LM Studio connection if using LM Studio
    let connectionTest = null
    if (aiInfo.isUsingLMStudio) {
      try {
        const baseUrl = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234'
        const testResponse = await fetch(`${baseUrl}/v1/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY ?? 'lm-studio'}`
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        connectionTest = {
          success: testResponse.ok,
          status: testResponse.status,
          statusText: testResponse.statusText,
          availableModels: undefined as string[] | undefined
        }
        
        if (testResponse.ok) {
          const models = await testResponse.json() as { data?: Array<{ id: string }> }
          connectionTest.availableModels = models.data?.map(m => m.id) ?? []
        }
      } catch (error) {
        connectionTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
        
        if (error instanceof Error && error.name === 'TimeoutError') {
          recommendations.push('LM Studio connection timed out. Please ensure LM Studio is running and accessible.')
        } else if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          recommendations.push('LM Studio is not running. Please start LM Studio and load a model.')
        }
      }
    }
    
    const summary = {
      overallValid: validation.isValid && additionalChecks.hasValidChatModel && additionalChecks.hasValidEmbeddingModel,
      usingLMStudio: aiInfo.isUsingLMStudio,
      chatModelValid: additionalChecks.hasValidChatModel,
      embeddingModelValid: additionalChecks.hasValidEmbeddingModel,
      connectionValid: connectionTest?.success ?? null
    }
    
    return NextResponse.json({
      summary,
      validation,
      aiInfo,
      additionalChecks,
      connectionTest,
      recommendations,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Model validation error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}