import { describe, it, expect } from 'vitest'
import { validateModelNames, getRecommendedModels, generateConfigurationHelp, looksLikeEmbeddingModel, looksLikeChatModel } from '../model-validation-utils'

describe('model-validation-utils', () => {
  it('validateModelNames: 明確な誤設定を検出する', () => {
    const r = validateModelNames('text-embedding-xyz', 'gpt-chat')
    expect(r.isValid).toBe(false)
    expect(r.issues.length).toBeGreaterThan(0)
  })

  it('looksLikeEmbeddingModel/ChatModel: それっぽい名前を判定', () => {
    expect(looksLikeEmbeddingModel('sentence-transformers/all-MiniLM-L6-v2')).toBe(true)
    expect(looksLikeChatModel('gemma-2-2b-it')).toBe(true)
  })

  it('generateConfigurationHelp: 文字列を返す', () => {
    const r = validateModelNames('text-embedding-xyz', 'gpt-chat')
    const s = generateConfigurationHelp(r)
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
  })

  it('getRecommendedModels: 推奨リストがある', () => {
    const m = getRecommendedModels()
    expect(m.chatModels.length).toBeGreaterThan(0)
    expect(m.embeddingModels.length).toBeGreaterThan(0)
  })
})


