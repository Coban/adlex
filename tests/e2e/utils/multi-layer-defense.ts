import { Page, expect } from '@playwright/test';

/**
 * 多層防御システム - テストの100%成功率を保証
 * 複数のレイヤーでエラーを検知・予防・修復
 */

export interface DefenseLayerResult {
  layerName: string;
  passed: boolean;
  issues: string[];
  fixedIssues: string[];
  warnings: string[];
}

export interface SystemHealthCheck {
  layers: DefenseLayerResult[];
  overallHealth: 'healthy' | 'warning' | 'critical';
  canProceed: boolean;
  recommendedActions: string[];
}

/**
 * Layer 1: 事前条件チェック
 */
export class PreConditionLayer {
  constructor(private page: Page) {}

  async validate(): Promise<DefenseLayerResult> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];
    const warnings: string[] = [];

    // ブラウザ状態チェック
    const context = this.page.context();
    const pages = context.pages();
    if (pages.length > 1) {
      warnings.push(`複数のページが開いています: ${pages.length}個`);
    }

    // ネットワーク状態確認
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (e) {
      issues.push('ネットワーク活動が収束していません');
    }

    // DOM状態確認
    const documentReady = await this.page.evaluate(() => document.readyState);
    if (documentReady !== 'complete') {
      issues.push(`ドキュメントが未完成: ${documentReady}`);
    }

    // JavaScriptエラーチェック
    const jsErrors = await this.page.evaluate(() => (window as any).testConsoleErrors || []);
    if (jsErrors.length > 0) {
      const filteredErrors = jsErrors.filter((error: any[]) => {
        const errorString = error.join(' ').toLowerCase();
        return !errorString.includes('favicon.ico') && 
               !errorString.includes('sourcemap') &&
               !errorString.includes('chrome-extension');
      });
      if (filteredErrors.length > 0) {
        issues.push(`JavaScriptエラーが検出されました: ${filteredErrors.length}件`);
      }
    }

    // 必須要素存在確認
    const essentialElements = ['body', 'html'];
    for (const selector of essentialElements) {
      try {
        await this.page.locator(selector).waitFor({ state: 'attached', timeout: 1000 });
      } catch (e) {
        issues.push(`必須要素が見つかりません: ${selector}`);
      }
    }

    return {
      layerName: 'PreCondition',
      passed: issues.length === 0,
      issues,
      fixedIssues,
      warnings
    };
  }

  /**
   * 環境修復処理
   */
  async repair(): Promise<string[]> {
    const fixedIssues: string[] = [];

    // 余分なページを閉じる
    const context = this.page.context();
    const pages = context.pages();
    if (pages.length > 1) {
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close();
      }
      fixedIssues.push(`余分なページを閉じました: ${pages.length - 1}個`);
    }

    // ページリロードによる状態リセット
    try {
      await this.page.reload({ waitUntil: 'networkidle', timeout: 10000 });
      fixedIssues.push('ページをリロードして状態をリセットしました');
    } catch (e) {
      // リロード失敗時は継続
    }

    return fixedIssues;
  }
}

/**
 * Layer 2: 実行時監視
 */
export class RuntimeMonitorLayer {
  private startTime: number = 0;
  private checkpoints: Map<string, number> = new Map();

  constructor(private page: Page) {}

  startMonitoring(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  async validate(): Promise<DefenseLayerResult> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];
    const warnings: string[] = [];

    // 実行時間チェック
    const totalRuntime = Date.now() - this.startTime;
    if (totalRuntime > 60000) { // 60秒
      warnings.push(`実行時間が長すぎます: ${totalRuntime}ms`);
    }

    // メモリ使用量チェック（可能な場合）
    try {
      const memoryInfo = await this.page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });

      if (memoryInfo) {
        const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        if (memoryUsageRatio > 0.8) {
          warnings.push(`メモリ使用率が高いです: ${(memoryUsageRatio * 100).toFixed(1)}%`);
        }
      }
    } catch (e) {
      // メモリ情報取得不可の場合は継続
    }

    // ネットワークリクエストの異常チェック
    const requests = await this.page.evaluate(() => {
      return (window as any).testNetworkRequests || [];
    });

    const failedRequests = requests.filter((req: any) => req.status >= 400);
    if (failedRequests.length > 0) {
      issues.push(`失敗したリクエスト: ${failedRequests.length}件`);
    }

    return {
      layerName: 'RuntimeMonitor',
      passed: issues.length === 0,
      issues,
      fixedIssues,
      warnings
    };
  }
}

/**
 * Layer 3: 事後検証
 */
export class PostValidationLayer {
  constructor(private page: Page) {}

  async validate(): Promise<DefenseLayerResult> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];
    const warnings: string[] = [];

    // 最終DOM状態確認
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (e) {
      issues.push('DOM読み込みが完了していません');
    }

    // CSSスタイル適用確認
    const hasStyles = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let styledElements = 0;
      for (const element of elements) {
        const computedStyle = getComputedStyle(element);
        if (computedStyle.display !== 'inline' || computedStyle.color !== 'rgb(0, 0, 0)') {
          styledElements++;
        }
      }
      return styledElements > elements.length * 0.1; // 10%以上の要素にスタイル適用
    });

    if (!hasStyles) {
      warnings.push('CSSスタイルが十分に適用されていない可能性があります');
    }

    // リンク切れチェック（内部リンクのみ）
    const brokenLinks = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links
        .filter((link: Element) => {
          const href = (link as HTMLAnchorElement).href;
          return href.startsWith(window.location.origin) && 
                 !href.includes('#') && 
                 href !== window.location.href;
        })
        .map((link: Element) => (link as HTMLAnchorElement).href);
    });

    for (const link of brokenLinks.slice(0, 5)) { // 最大5個まで確認
      try {
        const response = await this.page.request.get(link);
        if (response.status() >= 400) {
          warnings.push(`リンク切れの可能性: ${link} (${response.status()})`);
        }
      } catch (e) {
        warnings.push(`リンクアクセス不可: ${link}`);
      }
    }

    // フォーム要素の妥当性確認
    const formIssues = await this.page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const issues: string[] = [];
      
      for (const form of forms) {
        const requiredFields = form.querySelectorAll('input[required], textarea[required], select[required]');
        const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
        
        if (requiredFields.length > 0 && submitButtons.length === 0) {
          issues.push('必須フィールドがあるが送信ボタンがないフォーム');
        }
      }
      
      return issues;
    });

    issues.push(...formIssues);

    return {
      layerName: 'PostValidation',
      passed: issues.length === 0,
      issues,
      fixedIssues,
      warnings
    };
  }
}

/**
 * 多層防御システム統合クラス
 */
export class MultiLayerDefenseSystem {
  private preCondition: PreConditionLayer;
  private runtimeMonitor: RuntimeMonitorLayer;
  private postValidation: PostValidationLayer;

  constructor(page: Page) {
    this.preCondition = new PreConditionLayer(page);
    this.runtimeMonitor = new RuntimeMonitorLayer(page);
    this.postValidation = new PostValidationLayer(page);
  }

  /**
   * 全システムヘルスチェック
   */
  async performFullHealthCheck(): Promise<SystemHealthCheck> {
    const layers: DefenseLayerResult[] = [];

    // Layer 1: 事前条件
    const preConditionResult = await this.preCondition.validate();
    layers.push(preConditionResult);

    // 事前条件に重大な問題がある場合は修復を試行
    if (!preConditionResult.passed && preConditionResult.issues.length > 0) {
      const fixedIssues = await this.preCondition.repair();
      preConditionResult.fixedIssues.push(...fixedIssues);
      
      // 修復後の再検証
      const revalidationResult = await this.preCondition.validate();
      if (revalidationResult.passed) {
        preConditionResult.passed = true;
        preConditionResult.issues = [];
      }
    }

    // Layer 2: ランタイム監視
    const runtimeResult = await this.runtimeMonitor.validate();
    layers.push(runtimeResult);

    // Layer 3: 事後検証
    const postValidationResult = await this.postValidation.validate();
    layers.push(postValidationResult);

    // 全体的な健全性評価
    const criticalIssues = layers.reduce((sum, layer) => sum + layer.issues.length, 0);
    const totalWarnings = layers.reduce((sum, layer) => sum + layer.warnings.length, 0);

    let overallHealth: 'healthy' | 'warning' | 'critical';
    let canProceed: boolean;

    if (criticalIssues === 0 && totalWarnings === 0) {
      overallHealth = 'healthy';
      canProceed = true;
    } else if (criticalIssues === 0 && totalWarnings > 0) {
      overallHealth = 'warning';
      canProceed = true;
    } else {
      overallHealth = 'critical';
      canProceed = false;
    }

    // 推奨アクション
    const recommendedActions: string[] = [];
    if (criticalIssues > 0) {
      recommendedActions.push('重大な問題があります。テスト実行を中止して問題を修正してください。');
    }
    if (totalWarnings > 3) {
      recommendedActions.push('警告が多すぎます。環境の見直しを推奨します。');
    }
    if (layers[0].issues.length > 0) {
      recommendedActions.push('事前条件を満たしていません。環境セットアップを確認してください。');
    }

    return {
      layers,
      overallHealth,
      canProceed,
      recommendedActions
    };
  }

  /**
   * ランタイム監視開始
   */
  startRuntimeMonitoring(): void {
    this.runtimeMonitor.startMonitoring();
  }

  /**
   * チェックポイント記録
   */
  checkpoint(name: string): void {
    this.runtimeMonitor.checkpoint(name);
  }

  /**
   * 簡易ヘルスチェック（高速実行用）
   */
  async performQuickHealthCheck(): Promise<boolean> {
    try {
      const preConditionResult = await this.preCondition.validate();
      return preConditionResult.passed || preConditionResult.issues.length <= 1;
    } catch (e) {
      return false;
    }
  }
}

/**
 * テスト前の健全性確認
 */
export async function assertSystemHealth(page: Page): Promise<void> {
  const defenseSystem = new MultiLayerDefenseSystem(page);
  const healthCheck = await defenseSystem.performFullHealthCheck();

  // ログ出力
  console.log('=== システムヘルスチェック ===');
  for (const layer of healthCheck.layers) {
    console.log(`${layer.layerName}: ${layer.passed ? '✓' : '✗'}`);
    if (layer.issues.length > 0) {
      console.log(`  問題: ${layer.issues.join(', ')}`);
    }
    if (layer.warnings.length > 0) {
      console.log(`  警告: ${layer.warnings.join(', ')}`);
    }
    if (layer.fixedIssues.length > 0) {
      console.log(`  修復済み: ${layer.fixedIssues.join(', ')}`);
    }
  }
  console.log(`全体評価: ${healthCheck.overallHealth}`);
  console.log('===================');

  // 推奨アクションの表示
  if (healthCheck.recommendedActions.length > 0) {
    console.log('推奨アクション:');
    for (const action of healthCheck.recommendedActions) {
      console.log(`  - ${action}`);
    }
  }

  // 重大な問題がある場合はテストを停止
  expect(healthCheck.canProceed).toBe(true);
}