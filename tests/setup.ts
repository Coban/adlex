import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Mock Supabase clients first - must be hoisted before imports
vi.mock('@/lib/supabase/server', async () => {
  const { createMockSupabaseClient } = await import('./mocks/supabase');
  const { mockClient } = createMockSupabaseClient();
  
  return {
    createClient: () => mockClient,
  };
});

vi.mock('@/lib/supabase/client', async () => {
  const { createMockSupabaseClient } = await import('./mocks/supabase');
  const { mockClient } = createMockSupabaseClient();
  
  return {
    createClient: () => mockClient,
  };
});

// Mock the infra Supabase client used by API routes and use cases
vi.mock('@/infra/supabase/serverClient', async () => {
  const { createMockSupabaseClient } = await import('./mocks/supabase');
  const { mockClient } = createMockSupabaseClient();
  
  return {
    createClient: vi.fn(() => Promise.resolve(mockClient)),
  };
});

// Mock AI client to avoid dangerouslyAllowBrowser errors
vi.mock('@/lib/ai-client', () => ({
  createChatCompletion: vi.fn().mockResolvedValue({
    modified: 'テスト用の修正されたテキスト',
    violations: [],
  }),
  createEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
  getAIClientInfo: vi.fn().mockReturnValue({
    provider: 'mock',
    chatModel: 'mock-model',
    embeddingModel: 'mock-embedding-model',
  }),
  isUsingMock: vi.fn().mockReturnValue(true),
  hasValidApiKey: true,
}));

// Mock OpenAI directly to avoid browser environment errors
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                function: {
                  name: 'apply_yakukiho_rules',
                  arguments: JSON.stringify({
                    modified: 'テスト用の修正されたテキスト',
                    violations: [],
                  }),
                },
              }],
            },
          }],
        }),
      },
    },
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{
          embedding: new Array(384).fill(0.1),
        }],
      }),
    },
  })),
}));

import { server } from "./mocks/server";

// Extend global types for EventSource only
declare global {
  var EventSource: {
    new (url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource
    prototype: EventSource
    readonly CONNECTING: 0
    readonly OPEN: 1
    readonly CLOSED: 2
  }
}

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// Clean up after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());

// Mock environment variables for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}
  
  observe(_target: Element): void {}
  
  unobserve(_target: Element): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as {
  new (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ): IntersectionObserver;
  prototype: IntersectionObserver;
};

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Mock window.alert globally
Object.assign(window, {
  alert: vi.fn()
});

// Mock EventSource globally
const MockEventSource = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  dispatchEvent: vi.fn(),
  onerror: null,
  onmessage: null,
  onopen: null,
  readyState: 1,
  url: '',
  withCredentials: false,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
})) as any

// Add static properties
MockEventSource.CONNECTING = 0
MockEventSource.OPEN = 1
MockEventSource.CLOSED = 2

global.EventSource = MockEventSource

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve(''))
  }
});

