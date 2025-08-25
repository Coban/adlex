import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

// MSW のセットアップ
import { server } from './mocks/server'

// テスト開始前にサーバーを起動
beforeAll(() => server.listen())

// 各テスト後にクリーンアップとハンドラーをリセット
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// すべてのテスト終了後にサーバーを停止
afterAll(() => server.close())

// グローバルモック設定
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ResizeObserver のモック
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// EventSource のモック（テスト用）
const mockEventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}))
// Static properties for EventSource
Object.assign(mockEventSource, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
})
global.EventSource = mockEventSource as any

// URL のモック
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: vi.fn(() => 'mock-blob-url'),
    revokeObjectURL: vi.fn(),
  },
})

// Clipboard API のモック
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
})

// Crypto API のモック
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
})