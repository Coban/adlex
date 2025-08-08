/**
 * Model validation utilities for client-side configuration checking
 */

export interface ModelValidationResult {
  isValid: boolean
  issues: string[]
  suggestions: string[]
  chatModel: string
  embeddingModel: string
}

/**
 * Validate model names without requiring server-side access
 */
export function validateModelNames(chatModel: string, embeddingModel: string): ModelValidationResult {
  const issues: string[] = []
  const suggestions: string[] = []
  
  // Check if chat model looks like an embedding model
  if (chatModel.includes('embedding') || chatModel.includes('embed')) {
    issues.push(`Chat model "${chatModel}" appears to be an embedding model`)
    suggestions.push('Use a proper chat model like "microsoft/Phi-3-mini-4k-instruct-gguf" or "google/gemma-2-2b-it-gguf"')
  }
  
  // Check if embedding model looks like a chat model
  if (!embeddingModel.includes('embedding') && !embeddingModel.includes('embed')) {
    issues.push(`Embedding model "${embeddingModel}" might not be an embedding model`)
    suggestions.push('Use a proper embedding model like "text-embedding-nomic-embed-text-v1.5"')
  }
  
  // Check for common patterns that suggest model type confusion
  const chatModelLower = chatModel.toLowerCase()
  const embeddingModelLower = embeddingModel.toLowerCase()
  
  if (chatModelLower.includes('nomic') || chatModelLower.includes('sentence')) {
    issues.push(`Chat model "${chatModel}" appears to be designed for embeddings`)
    suggestions.push('Use an instruction-tuned model for chat like "microsoft/Phi-3-mini-4k-instruct-gguf"')
  }
  
  if (embeddingModelLower.includes('instruct') || embeddingModelLower.includes('chat')) {
    issues.push(`Embedding model "${embeddingModel}" appears to be designed for chat`)
    suggestions.push('Use a dedicated embedding model like "text-embedding-nomic-embed-text-v1.5"')
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    chatModel,
    embeddingModel
  }
}

/**
 * Get recommended model configurations
 */
export function getRecommendedModels() {
  return {
    chatModels: [
      'microsoft/Phi-3-mini-4k-instruct-gguf',
      'google/gemma-2-2b-it-gguf',
      'microsoft/DialoGPT-medium',
      'HuggingFaceTB/SmolLM-1.7B-Instruct-GGUF'
    ],
    embeddingModels: [
      'text-embedding-nomic-embed-text-v1.5',
      'sentence-transformers/all-MiniLM-L6-v2',
      'intfloat/e5-small-v2'
    ]
  }
}

/**
 * Generate configuration help text
 */
export function generateConfigurationHelp(validation: ModelValidationResult): string {
  if (validation.isValid) {
    return 'Model configuration looks good!'
  }
  
  let help = 'Model Configuration Issues:\n\n'
  
  validation.issues.forEach((issue, index) => {
    help += `${index + 1}. ${issue}\n`
  })
  
  help += '\nRecommended Actions:\n\n'
  
  validation.suggestions.forEach((suggestion, index) => {
    help += `${index + 1}. ${suggestion}\n`
  })
  
  const recommended = getRecommendedModels()
  
  help += '\nRecommended Models:\n\n'
  help += 'Chat Models:\n'
  recommended.chatModels.forEach(model => {
    help += `- ${model}\n`
  })
  
  help += '\nEmbedding Models:\n'
  recommended.embeddingModels.forEach(model => {
    help += `- ${model}\n`
  })
  
  help += '\nEnvironment Variables:\n'
  help += 'LM_STUDIO_CHAT_MODEL="microsoft/Phi-3-mini-4k-instruct-gguf"\n'
  help += 'LM_STUDIO_EMBEDDING_MODEL="text-embedding-nomic-embed-text-v1.5"\n'
  help += 'LM_STUDIO_BASE_URL="http://localhost:1234/v1"\n'
  help += 'USE_LM_STUDIO="true"\n'
  
  return help
}

/**
 * Check if a model name suggests it's for embeddings
 */
export function looksLikeEmbeddingModel(modelName: string): boolean {
  const name = modelName.toLowerCase()
  return name.includes('embedding') || 
         name.includes('embed') || 
         name.includes('nomic') || 
         name.includes('sentence') ||
         name.includes('e5-') ||
         name.includes('bge-')
}

/**
 * Check if a model name suggests it's for chat/instruction following
 */
export function looksLikeChatModel(modelName: string): boolean {
  const name = modelName.toLowerCase()
  return name.includes('instruct') || 
         name.includes('chat') || 
         name.includes('it-') ||
         name.includes('dialog') ||
         name.includes('conversation') ||
         name.includes('phi-') ||
         name.includes('gemma') ||
         name.includes('llama')
}