import { Page, Browser, BrowserContext } from '@playwright/test';

/**
 * 自己診断システム - テスト実行環境の自動検証と修復
 */

export interface DiagnosticResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details: Record<string, any>;
  suggestions: string[];
  autoFixed: boolean;
}

export interface FullDiagnosticReport {
  timestamp: string;
  environment: string;
  overallStatus: 'healthy' | 'degraded' | 'failed';
  results: DiagnosticResult[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    autoFixed: number;
  };
  canProceedWithTests: boolean;
}

/**
 * ブラウザ環境診断
 */
export class BrowserDiagnostic {
  constructor(private browser: Browser) {}

  async diagnose(): Promise<DiagnosticResult> {
    const details: Record<string, any> = {};
    const suggestions: string[] = [];
    let status: DiagnosticResult['status'] = 'healthy';
    let message = 'ブラウザ環境は正常です';
    let autoFixed = false;

    try {
      // ブラウザ情報収集
      const version = this.browser.version();
      details.version = version;
      details.browserName = this.browser.browserType().name();

      // コンテキスト数チェック
      const contexts = this.browser.contexts();
      details.contextCount = contexts.length;

      if (contexts.length > 2) {
        status = 'warning';
        message = '多数のブラウザコンテキストが存在します';
        suggestions.push('不要なコンテキストを閉じることを推奨します');
      }

      // ページ数チェック
      let totalPages = 0;
      for (const context of contexts) {
        totalPages += context.pages().length;
      }
      details.totalPages = totalPages;

      if (totalPages > 5) {
        status = 'warning';
        message = '多数のページが開いています';
        suggestions.push('不要なページを閉じることを推奨します');
        
        // 自動修復: 3個以上のページがある場合、最初以外を閉じる
        for (const context of contexts) {
          const pages = context.pages();
          for (let i = 1; i < pages.length; i++) {
            await pages[i].close();
            autoFixed = true;
          }
        }
        
        if (autoFixed) {
          message = '多数のページが開いていましたが、自動的に閉じました';
          status = 'healthy';
        }
      }

    } catch (error) {
      status = 'critical';
      message = `ブラウザ診断中にエラーが発生しました: ${error}`;
      details.error = String(error);
      suggestions.push('ブラウザを再起動してください');
    }

    return {
      component: 'Browser',
      status,
      message,
      details,
      suggestions,
      autoFixed
    };
  }
}

/**
 * ネットワーク診断
 */
export class NetworkDiagnostic {
  constructor(private page: Page) {}

  async diagnose(): Promise<DiagnosticResult> {
    const details: Record<string, any> = {};
    const suggestions: string[] = [];
    let status: DiagnosticResult['status'] = 'healthy';
    let message = 'ネットワーク接続は正常です';

    try {
      // 基本接続テスト
      const startTime = Date.now();
      await this.page.goto('about:blank', { timeout: 10000 });
      const loadTime = Date.now() - startTime;
      details.basicLoadTime = loadTime;

      if (loadTime > 5000) {
        status = 'warning';
        message = 'ネットワーク応答が遅いです';
        suggestions.push('ネットワーク接続を確認してください');
      }

      // localhost 接続テスト
      try {
        const response = await this.page.request.get('http://localhost:3001/api/health', {
          timeout: 5000
        });
        details.localhostStatus = response.status();
        details.localhostResponse = await response.text().catch(() => 'N/A');
        
        if (response.status() >= 400) {
          status = 'critical';
          message = 'アプリケーションサーバーが応答していません';
          suggestions.push('npm run dev でサーバーを起動してください');
        }
      } catch (error) {
        status = 'critical';
        message = 'localhost:3001 に接続できません';
        details.localhostError = String(error);
        suggestions.push('npm run dev でサーバーを起動してください');
        suggestions.push('ポート3001が使用可能か確認してください');
      }

      // DNS解決テスト
      const dnsTestDomains = ['localhost', '127.0.0.1'];
      details.dnsResults = {};
      
      for (const domain of dnsTestDomains) {
        try {
          const dnsStart = Date.now();
          await this.page.request.get(`http://${domain}:3001`, { timeout: 3000 });
          details.dnsResults[domain] = Date.now() - dnsStart;
        } catch (error) {
          details.dnsResults[domain] = `Error: ${error}`;
        }
      }

    } catch (error) {
      status = 'critical';
      message = `ネットワーク診断中にエラーが発生しました: ${error}`;
      details.error = String(error);
      suggestions.push('ネットワーク設定を確認してください');
    }

    return {
      component: 'Network',
      status,
      message,
      details,
      suggestions,
      autoFixed: false
    };
  }
}

/**
 * DOM/UI診断
 */
export class DomDiagnostic {
  constructor(private page: Page) {}

  async diagnose(): Promise<DiagnosticResult> {
    const details: Record<string, any> = {};
    const suggestions: string[] = [];
    let status: DiagnosticResult['status'] = 'healthy';
    let message = 'DOM状態は正常です';
    let autoFixed = false;

    try {
      // 基本DOM構造確認
      const documentState = await this.page.evaluate(() => {
        return {
          readyState: document.readyState,
          title: document.title,
          url: window.location.href,
          hasBody: !!document.body,
          elementCount: document.querySelectorAll('*').length,
          scriptCount: document.querySelectorAll('script').length,
          styleCount: document.querySelectorAll('style, link[rel="stylesheet"]').length
        };
      });
      details.documentState = documentState;

      if (documentState.readyState !== 'complete') {
        status = 'warning';
        message = 'ドキュメントの読み込みが完了していません';
        suggestions.push('DOM読み込み完了を待機してください');
      }

      if (documentState.elementCount < 10) {
        status = 'warning';
        message = 'DOM要素が少なすぎます';
        suggestions.push('ページが正しく読み込まれているか確認してください');
      }

      // JavaScript エラー確認
      const jsErrors = await this.page.evaluate(() => {
        return (window as any).testConsoleErrors || [];
      });
      
      details.jsErrorCount = jsErrors.length;
      if (jsErrors.length > 0) {
        const significantErrors = jsErrors.filter((error: any[]) => {
          const errorString = error.join(' ').toLowerCase();
          return !errorString.includes('favicon.ico') &&
                 !errorString.includes('sourcemap') &&
                 !errorString.includes('chrome-extension');
        });
        
        details.significantErrorCount = significantErrors.length;
        if (significantErrors.length > 0) {
          status = 'warning';
          message = 'JavaScriptエラーが検出されました';
          suggestions.push('コンソールエラーを確認してください');
          details.sampleErrors = significantErrors.slice(0, 3);
        }
      }

      // CSS読み込み確認
      const cssInfo = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const styles = Array.from(document.querySelectorAll('style'));
        
        return {
          externalStylesheets: links.length,
          inlineStyles: styles.length,
          computedStylesApplied: getComputedStyle(document.body).color !== ''
        };
      });
      
      details.cssInfo = cssInfo;
      if (!cssInfo.computedStylesApplied) {
        status = 'warning';
        message = 'CSSが正しく適用されていない可能性があります';
        suggestions.push('スタイルシートの読み込みを確認してください');
      }

      // フォーカス可能要素のチェック
      const focusableElements = await this.page.evaluate(() => {
        const focusable = document.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        return focusable.length;
      });
      
      details.focusableElementCount = focusableElements;

      // アクセシビリティ基本チェック
      const a11yInfo = await this.page.evaluate(() => {
        const images = document.querySelectorAll('img');
        const imagesWithoutAlt = Array.from(images).filter(img => !img.getAttribute('alt'));
        
        const buttons = document.querySelectorAll('button');
        const buttonsWithoutText = Array.from(buttons).filter(btn => !btn.textContent?.trim());
        
        return {
          totalImages: images.length,
          imagesWithoutAlt: imagesWithoutAlt.length,
          totalButtons: buttons.length,
          buttonsWithoutText: buttonsWithoutText.length
        };
      });
      
      details.accessibility = a11yInfo;
      
      if (a11yInfo.imagesWithoutAlt > 0 || a11yInfo.buttonsWithoutText > 0) {
        status = status === 'critical' ? 'critical' : 'warning';
        message = 'アクセシビリティの問題が検出されました';
        suggestions.push('画像のalt属性やボタンのテキストを確認してください');
      }

    } catch (error) {
      status = 'critical';
      message = `DOM診断中にエラーが発生しました: ${error}`;
      details.error = String(error);
      suggestions.push('ページを再読み込みしてください');
    }

    return {
      component: 'DOM/UI',
      status,
      message,
      details,
      suggestions,
      autoFixed
    };
  }
}

/**
 * パフォーマンス診断
 */
export class PerformanceDiagnostic {
  constructor(private page: Page) {}

  async diagnose(): Promise<DiagnosticResult> {
    const details: Record<string, any> = {};
    const suggestions: string[] = [];
    let status: DiagnosticResult['status'] = 'healthy';
    let message = 'パフォーマンスは良好です';

    try {
      // メモリ使用量（利用可能な場合）
      const memoryInfo = await this.page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });

      if (memoryInfo) {
        details.memory = memoryInfo;
        const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        details.memoryUsageRatio = usageRatio;

        if (usageRatio > 0.8) {
          status = 'warning';
          message = 'メモリ使用量が高いです';
          suggestions.push('ページを再読み込みしてメモリをクリアしてください');
        } else if (usageRatio > 0.9) {
          status = 'critical';
          message = 'メモリ不足の危険性があります';
          suggestions.push('ブラウザを再起動してください');
        }
      }

      // パフォーマンスタイミング
      const timing = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!nav) return null;
        
        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
          loadComplete: nav.loadEventEnd - nav.loadEventStart,
          domInteractive: nav.domInteractive - nav.fetchStart,
          totalTime: nav.loadEventEnd - nav.fetchStart
        };
      });

      if (timing) {
        details.timing = timing;
        
        if (timing.totalTime > 10000) {
          status = 'warning';
          message = 'ページ読み込み時間が長いです';
          suggestions.push('ネットワーク環境を確認してください');
        }
        
        if (timing.domContentLoaded > 5000) {
          status = status === 'critical' ? 'critical' : 'warning';
          suggestions.push('DOM構築時間を短縮する必要があります');
        }
      }

      // リソース読み込み分析
      const resources = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        
        const analysis = {
          totalRequests: entries.length,
          failedRequests: 0,
          slowRequests: 0,
          largeResources: 0,
          avgDuration: 0
        };

        let totalDuration = 0;
        
        for (const entry of entries) {
          const duration = entry.responseEnd - entry.requestStart;
          totalDuration += duration;
          
          if (duration > 2000) analysis.slowRequests++;
          if (entry.transferSize && entry.transferSize > 1000000) analysis.largeResources++; // 1MB以上
        }
        
        analysis.avgDuration = entries.length > 0 ? totalDuration / entries.length : 0;
        
        return analysis;
      });

      details.resources = resources;
      
      if (resources.slowRequests > 0) {
        status = status === 'critical' ? 'critical' : 'warning';
        message = '遅いリクエストが検出されました';
        suggestions.push('ネットワークまたはサーバーの最適化を検討してください');
      }

    } catch (error) {
      status = 'critical';
      message = `パフォーマンス診断中にエラーが発生しました: ${error}`;
      details.error = String(error);
    }

    return {
      component: 'Performance',
      status,
      message,
      details,
      suggestions,
      autoFixed: false
    };
  }
}

/**
 * 統合自己診断システム
 */
export class SelfDiagnosticSystem {
  private browserDiagnostic: BrowserDiagnostic;
  private networkDiagnostic: NetworkDiagnostic;
  private domDiagnostic: DomDiagnostic;
  private performanceDiagnostic: PerformanceDiagnostic;

  constructor(browser: Browser, page: Page) {
    this.browserDiagnostic = new BrowserDiagnostic(browser);
    this.networkDiagnostic = new NetworkDiagnostic(page);
    this.domDiagnostic = new DomDiagnostic(page);
    this.performanceDiagnostic = new PerformanceDiagnostic(page);
  }

  /**
   * 完全診断実行
   */
  async runFullDiagnostic(): Promise<FullDiagnosticReport> {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'unknown';
    const results: DiagnosticResult[] = [];

    // 並行診断実行
    const diagnosticPromises = [
      this.browserDiagnostic.diagnose(),
      this.networkDiagnostic.diagnose(),
      this.domDiagnostic.diagnose(),
      this.performanceDiagnostic.diagnose()
    ];

    const diagnosticResults = await Promise.allSettled(diagnosticPromises);
    
    for (const result of diagnosticResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          component: 'Unknown',
          status: 'critical',
          message: `診断実行エラー: ${result.reason}`,
          details: { error: String(result.reason) },
          suggestions: ['システムを再起動してください'],
          autoFixed: false
        });
      }
    }

    // サマリー計算
    const summary = {
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      critical: results.filter(r => r.status === 'critical').length,
      autoFixed: results.filter(r => r.autoFixed).length
    };

    // 全体ステータス決定
    let overallStatus: FullDiagnosticReport['overallStatus'];
    if (summary.critical > 0) {
      overallStatus = 'failed';
    } else if (summary.warning > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const canProceedWithTests = summary.critical === 0;

    return {
      timestamp,
      environment,
      overallStatus,
      results,
      summary,
      canProceedWithTests
    };
  }

  /**
   * 高速診断（重要項目のみ）
   */
  async runQuickDiagnostic(): Promise<boolean> {
    try {
      const networkResult = await this.networkDiagnostic.diagnose();
      const domResult = await this.domDiagnostic.diagnose();
      
      return networkResult.status !== 'critical' && domResult.status !== 'critical';
    } catch (error) {
      return false;
    }
  }

  /**
   * 診断レポート出力
   */
  static printDiagnosticReport(report: FullDiagnosticReport): void {
    console.log('\n=== 自己診断レポート ===');
    console.log(`時刻: ${report.timestamp}`);
    console.log(`環境: ${report.environment}`);
    console.log(`全体ステータス: ${report.overallStatus}`);
    console.log(`テスト実行可能: ${report.canProceedWithTests ? '✓' : '✗'}`);
    
    console.log('\n--- コンポーネント別診断結果 ---');
    for (const result of report.results) {
      const statusIcon = {
        healthy: '✓',
        warning: '⚠',
        critical: '✗',
        unknown: '?'
      }[result.status];
      
      console.log(`${statusIcon} ${result.component}: ${result.message}`);
      
      if (result.suggestions.length > 0) {
        console.log(`   推奨: ${result.suggestions.join(', ')}`);
      }
      
      if (result.autoFixed) {
        console.log(`   自動修復: 済み`);
      }
    }
    
    console.log('\n--- サマリー ---');
    console.log(`正常: ${report.summary.healthy}, 警告: ${report.summary.warning}, 重大: ${report.summary.critical}, 自動修復: ${report.summary.autoFixed}`);
    console.log('===================\n');
  }
}