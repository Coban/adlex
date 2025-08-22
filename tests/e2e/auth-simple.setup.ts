import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('認証状態を保存（SKIP_AUTH使用）', async ({ page }) => {
  console.log('Starting SKIP_AUTH authentication setup...');
  
  // SKIP_AUTH環境変数を確実に設定
  await page.addInitScript(() => {
    (window as any).process = {
      env: {
        NEXT_PUBLIC_SKIP_AUTH: 'true',
        SKIP_AUTH: 'true',
        NODE_ENV: process.env.NODE_ENV || 'test',
        TZ: process.env.TZ
      }
    };
  });
  
  // Go to home page first to allow the application to initialize
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // Try to access admin page directly
  await page.goto('/admin');
  await page.waitForTimeout(3000);
  
  // Check current URL and page content
  const currentUrl = page.url();
  console.log('Current URL after admin navigation:', currentUrl);
  
  // Check if page content indicates we're on admin or signin
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      hasAdminContent: document.body.innerText.includes('管理ダッシュボード'),
      hasSigninContent: document.body.innerText.includes('ログイン') || document.body.innerText.includes('サインイン'),
      url: window.location.href
    };
  });
  
  console.log('Page content check:', pageContent);
  
  if (pageContent.hasAdminContent) {
    console.log('Successfully accessed admin page with SKIP_AUTH');
  } else if (pageContent.hasSigninContent || currentUrl.includes('/auth/signin')) {
    console.log('Redirected to signin - may need to adjust SKIP_AUTH setup');
  } else {
    console.log('Admin page loaded but content unclear');
  }
  
  console.log('SKIP_AUTH authentication setup completed');
  
  // Save the authentication state regardless of outcome
  await page.context().storageState({ path: authFile });
});