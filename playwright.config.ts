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
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
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
      retries: 1, // エラーテストは少ない再試行
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
    // 環境適応型設定 - テスト内で動的に制御
    env: {
      // Load from .env.e2e first
      ...envFromTestingFile,
      // Explicit overrides for E2E testing
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'mock',
      USE_LM_STUDIO: 'false',
      NEXT_PUBLIC_MSW_ENABLED: envFromTestingFile.NEXT_PUBLIC_MSW_ENABLED ?? 'false',
      NEXT_PUBLIC_APP_URL: envFromTestingFile.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
      ADLEX_MAX_CONCURRENT_CHECKS: envFromTestingFile.ADLEX_MAX_CONCURRENT_CHECKS ?? '3',
      // グローバルセットアップによる認証状態生成のため、SKIP_AUTHは無効化
      SKIP_AUTH: 'false',
      NEXT_PUBLIC_SKIP_AUTH: 'false',
    },
  },
});
