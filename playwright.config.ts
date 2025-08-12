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

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
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
    video: "retain-on-failure",
    
    /* Timeout for individual actions */
    actionTimeout: 30000,
  },
  
  /* Test timeout */
  timeout: 60000,

  /* Configure projects for major browsers */
  projects: [
    // Setup project for authentication
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        // Use the authenticated state for most tests
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Auth tests that run without authentication
    {
      name: "chromium-noauth",
      testMatch: /.*auth\.spec\.ts/,
      use: { 
        ...devices["Desktop Chrome"],
        // No authentication state for auth tests
        storageState: { cookies: [], origins: [] },
      },
    },

    {
      name: "firefox",
      use: { 
        ...devices["Desktop Firefox"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: "webkit",
      use: { 
        ...devices["Desktop Safari"],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { 
        ...devices["Pixel 5"],
        storageState: 'playwright/.auth/user.json',
        hasTouch: true,
      },
      dependencies: ['setup'],
    },
    {
      name: "Mobile Safari",
      use: { 
        ...devices["iPhone 12"],
        storageState: 'playwright/.auth/user.json',
        hasTouch: true,
      },
      dependencies: ['setup'],
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
    // E2EテストではMSWを無効化し、実際のSupabaseローカル環境を使用
    env: {
      // Load from .env.testing first
      ...envFromTestingFile,
      // Explicit overrides for stability
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'mock',
      USE_LM_STUDIO: 'false',
      NEXT_PUBLIC_MSW_ENABLED: envFromTestingFile.NEXT_PUBLIC_MSW_ENABLED ?? 'false',
      NEXT_PUBLIC_APP_URL: envFromTestingFile.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
      ADLEX_MAX_CONCURRENT_CHECKS: envFromTestingFile.ADLEX_MAX_CONCURRENT_CHECKS ?? '3',
      // SKIP_AUTH: 'true',           // 実際の認証フローをテストするため削除
      // NEXT_PUBLIC_SKIP_AUTH: 'true', // 実際の認証フローをテストするため削除
    },
  },
});
