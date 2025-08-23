import fs from 'fs'
import path from 'path'

import { defineConfig, devices } from "@playwright/test";

// Load additional env vars from .env.testing for E2E runs
function loadEnvFile(filePath: string): Record<string, string> {
  try {
    const absPath = path.resolve(process.cwd(), filePath)
    if (!fs.existsSync(absPath)) return {}
    const content = fs.readFileSync(absPath, 'utf8')
    const result: Record<string, string> = {}
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).trim()
      if (key) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

const envFromTestingFile = loadEnvFile('.env.e2e')

// テストプロセスに環境変数を設定
Object.entries(envFromTestingFile).forEach(([key, value]) => {
  process.env[key] ??= value;
});

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  
  /* Global setup for database seeding and storageState generation */
  globalSetup: './tests/setup/global-setup.ts',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* 決定論的再試行戦略 - 100%成功率を目指す */
  retries: 0, // 再試行に依存せず、一発で成功するテストを目標
  /* 並行実行制御 - 競合状態を排除 */
  workers: 1, // 完全にシーケンシャル実行で決定論化
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-reports/html' }],
    ['json', { outputFile: 'test-reports/results.json' }],
    ['junit', { outputFile: 'test-reports/junit.xml' }],
    ...(process.env.CI ? [['github'] as const] : [])
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video recording */
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    /* Timeout for individual actions - increased for stability */
    actionTimeout: 30000,
    
    /* Navigation timeout - increased for stability */
    navigationTimeout: 30000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Additional stability settings */
    launchOptions: {
      // Slower operations for stability
      slowMo: process.env.CI ? 0 : 100,
    },
    
    /* Context options for better stability */
    contextOptions: {
      // Disable animations that can cause flaky tests
      reducedMotion: 'reduce',
    },
  },
  
  /* Test timeout - increased for stability */
  timeout: 90000,
  
  /* Expect timeout for assertions */
  expect: {
    timeout: 15000,
  },

  /* Configure projects for major browsers */
  projects: [
    // ゲストユーザー用プロジェクト（認証なし）
    {
      name: "chromium",
      testDir: "./tests/e2e",
      testIgnore: ['**/admin-*.spec.ts'], // 管理者テストを除外
      use: { 
        ...devices["Desktop Chrome"],
        storageState: './tests/.auth/user.json', // 一般ユーザー認証状態
      },
    },

    // 管理者用プロジェクト（管理者認証済み）
    {
      name: "chromium-admin",
      testDir: "./tests/e2e",
      testMatch: ['**/admin-*.spec.ts'], // 管理者テストのみ
      use: { 
        ...devices["Desktop Chrome"],
        storageState: './tests/.auth/admin.json', // 管理者認証状態
      },
    },

    // 認証なしプロジェクト（エラーハンドリングテスト等）
    {
      name: "chromium-no-auth",
      testDir: "./tests/e2e",
      testMatch: ['**/error-handling.spec.ts'],
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] }, // 認証なし
        actionTimeout: 60000, // エラーシナリオ用の長いタイムアウト
        navigationTimeout: 60000,
      },
      retries: 0, // 決定論的実行 - 再試行なし
    },
    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
    // 決定論的な静的設定 - 100%再現可能な環境
    env: {
      // 基本環境設定
      NODE_ENV: 'test',
      TZ: 'UTC', // タイムゾーンを固定
      
      // AI設定（モック使用で決定論化）
      AI_PROVIDER: 'mock',
      OPENAI_API_KEY: 'test-mock-key-deterministic',
      USE_LM_STUDIO: 'false',
      
      // アプリケーション設定（固定値）
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
      ADLEX_MAX_CONCURRENT_CHECKS: '1', // 並行処理を無効化して決定論化
      
      // Supabase設定（テスト用固定値）
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-deterministic-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-deterministic-service-key',
      
      // MSW設定
      NEXT_PUBLIC_MSW_ENABLED: 'false', // E2Eテストでは無効
      
      // 認証設定（静的）
      SKIP_AUTH: 'false',
      NEXT_PUBLIC_SKIP_AUTH: 'false',
      
      // デバッグ・ログ設定
      DEBUG: '',
      LOG_LEVEL: 'error', // ログノイズを削減
      
      // ランダム性排除
      NODE_OPTIONS: '--max-old-space-size=4096',
      FORCE_COLOR: '0', // カラー出力を無効化
    },
  },
});
