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
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video recording */
    video: "off",
    
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
    // Primary Chrome project - runs all tests with environment-adaptive authentication
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        // Always start with clean state - tests will handle authentication dynamically
        storageState: { cookies: [], origins: [] },
      },
    },

    // Mobile testing project
    {
      name: "mobile", 
      testIgnore: [/.*admin-management.*\.spec\.ts/], // Mobile doesn't test admin features
      use: { 
        ...devices["Pixel 5"],
        storageState: { cookies: [], origins: [] },
        hasTouch: true,
      },
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
      // Explicit overrides for stability
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'mock',
      USE_LM_STUDIO: 'false',
      NEXT_PUBLIC_MSW_ENABLED: envFromTestingFile.NEXT_PUBLIC_MSW_ENABLED ?? 'false',
      NEXT_PUBLIC_APP_URL: envFromTestingFile.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
      ADLEX_MAX_CONCURRENT_CHECKS: envFromTestingFile.ADLEX_MAX_CONCURRENT_CHECKS ?? '3',
      // 環境設定は .env.e2e ファイルから読み込み（デフォルトはSKIP_AUTH=true）
      SKIP_AUTH: envFromTestingFile.SKIP_AUTH ?? 'true',
      NEXT_PUBLIC_SKIP_AUTH: envFromTestingFile.NEXT_PUBLIC_SKIP_AUTH ?? 'true',
    },
  },
});
