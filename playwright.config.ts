import { defineConfig, devices } from "@playwright/test";

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
  },

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
      },
      dependencies: ['setup'],
    },
    {
      name: "Mobile Safari",
      use: { 
        ...devices["iPhone 12"],
        storageState: 'playwright/.auth/user.json',
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
    reuseExistingServer: false,
    timeout: 120 * 1000,
    // E2EテストではMSWを無効化し、実際のSupabaseローカル環境を使用
    env: {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'mock',
      USE_LM_STUDIO: 'false',
    },
  },
});
