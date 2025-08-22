/**
 * T007: テストデータ管理の改善
 * テストユーザーデータのセットアップ自動化
 * テスト用辞書データの標準化
 * モックデータジェネレータの作成
 */

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  status?: 'active' | 'suspended' | 'pending';
  organizationId?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
}

export interface TestOrganization {
  id?: string;
  name: string;
  maxUsers?: number;
  maxChecks?: number;
  status?: 'active' | 'suspended';
  createdAt?: string;
}

export interface TestDictionaryEntry {
  id?: string;
  phrase: string;
  type: 'NG' | 'ALLOW';
  category: string;
  reason?: string;
  severity?: 'high' | 'medium' | 'low';
  createdAt?: string;
  embedding?: number[];
}

export interface TestViolation {
  id?: string;
  text: string;
  reason: string;
  start: number;
  end: number;
  suggestions: string[];
  severity?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface TestCheckResult {
  id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  violations: TestViolation[];
  originalText?: string;
  processedAt?: string;
  createdAt?: string;
}

/**
 * テストデータ生成ファクトリ
 */
export class TestDataFactory {
  private static counter = 0;

  /**
   * ユニークなIDを生成
   */
  private static generateId(prefix = 'test'): string {
    this.counter++;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }

  /**
   * ユニークなメールアドレスを生成
   */
  private static generateEmail(role: 'admin' | 'user' = 'user', domain = 'example.com'): string {
    return `test-${role}-${Date.now()}-${this.counter}@${domain}`;
  }

  /**
   * テストユーザーデータの作成
   */
  static createMockUser(role: 'admin' | 'user' = 'user', overrides: Partial<TestUser> = {}): TestUser {
    const baseUser: TestUser = {
      id: this.generateId('user'),
      email: this.generateEmail(role),
      password: 'password123',
      role,
      status: 'active',
      organizationId: this.generateId('org'),
      createdAt: new Date().toISOString(),
      firstName: role === 'admin' ? '管理者' : 'ユーザー',
      lastName: `テスト${this.counter}`
    };

    return { ...baseUser, ...overrides };
  }

  /**
   * 複数のテストユーザーを作成
   */
  static createMockUsers(count: number, role: 'admin' | 'user' = 'user'): TestUser[] {
    return Array.from({ length: count }, () => this.createMockUser(role));
  }

  /**
   * 管理者と一般ユーザーの混合セットを作成
   */
  static createMockUserSet(): { admins: TestUser[]; users: TestUser[] } {
    return {
      admins: [
        this.createMockUser('admin', { email: 'admin@test.com' }),
        this.createMockUser('admin', { email: 'admin2@test.com' })
      ],
      users: [
        this.createMockUser('user', { email: 'user1@test.com' }),
        this.createMockUser('user', { email: 'user2@test.com' }),
        this.createMockUser('user', { email: 'user3@test.com' })
      ]
    };
  }

  /**
   * テスト組織データの作成
   */
  static createMockOrganization(overrides: Partial<TestOrganization> = {}): TestOrganization {
    const baseOrg: TestOrganization = {
      id: this.generateId('org'),
      name: `テスト組織${this.counter}`,
      maxUsers: 50,
      maxChecks: 10000,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    return { ...baseOrg, ...overrides };
  }

  /**
   * 薬機法違反テキストのパターン作成
   */
  static createMockViolationText(type: 'medical' | 'exaggerated' | 'doctor' | 'safe'): string {
    const templates = {
      medical: [
        'がんが治る効果があります',
        '血圧が下がる効果が期待できます',
        '糖尿病が改善される健康食品',
        'アトピーが完治するサプリメント',
        '薬事法対応済みの医薬品レベル効果'
      ],
      exaggerated: [
        '100%効果保証！必ず痩せます',
        '世界初の革命的技術で確実に効果',
        '絶対に効果がある奇跡のサプリ',
        '他にはない特別な効果をお約束',
        '効果がなければ全額返金保証'
      ],
      doctor: [
        '医師も推薦する特効薬レベル',
        'お医者さんが選ぶNo.1サプリ',
        '医療従事者が愛用する健康食品',
        '病院でも使われている成分配合',
        'ドクター監修の医薬品並み効果'
      ],
      safe: [
        '美味しくて栄養価の高い健康食品です',
        '毎日の健康維持にお役立てください',
        'バランスの良い食生活をサポート',
        '自然由来の成分を使用した食品',
        '健康的なライフスタイルを応援'
      ]
    };

    const typeTemplates = templates[type];
    return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  }

  /**
   * 辞書エントリーデータの作成
   */
  static createMockDictionaryEntry(
    type: 'NG' | 'ALLOW' = 'NG',
    overrides: Partial<TestDictionaryEntry> = {}
  ): TestDictionaryEntry {
    const ngPhrases = [
      '治る', '完治', '効果保証', '医師推薦', '薬事法対応',
      'がんに効く', '血圧を下げる', '糖尿病改善', '100%効果'
    ];
    
    const allowPhrases = [
      '健康維持', '栄養補給', 'バランス', '自然由来',
      'サポート', '応援', '美味しい', '安心安全'
    ];

    const phrases = type === 'NG' ? ngPhrases : allowPhrases;
    const categories = {
      NG: ['医薬品効果', '誇大広告', '医師推薦', '効果保証'],
      ALLOW: ['一般表現', '栄養成分', '味覚表現', '安全性']
    };

    const baseEntry: TestDictionaryEntry = {
      id: this.generateId('dict'),
      phrase: phrases[Math.floor(Math.random() * phrases.length)],
      type,
      category: categories[type][Math.floor(Math.random() * categories[type].length)],
      reason: type === 'NG' ? '薬機法に抵触する表現' : '適切な表現',
      severity: type === 'NG' ? 'high' : 'low',
      createdAt: new Date().toISOString()
    };

    return { ...baseEntry, ...overrides };
  }

  /**
   * 複数の辞書エントリーを作成
   */
  static createMockDictionaries(ngCount = 10, allowCount = 5): TestDictionaryEntry[] {
    const ngEntries = Array.from({ length: ngCount }, () => 
      this.createMockDictionaryEntry('NG')
    );
    const allowEntries = Array.from({ length: allowCount }, () => 
      this.createMockDictionaryEntry('ALLOW')
    );

    return [...ngEntries, ...allowEntries];
  }

  /**
   * 違反情報の作成
   */
  static createMockViolation(overrides: Partial<TestViolation> = {}): TestViolation {
    const violationReasons = [
      '医薬品的効果効能の表現が含まれています',
      '誇大な効果を謳う表現です',
      '医師の推薦を装った表現です',
      '効果を保証する表現が含まれています',
      '薬機法に抵触する可能性があります'
    ];

    const suggestions = [
      '「効果があります」→「健康をサポート」',
      '「治る」→「健康維持に役立つ」',
      '「100%効果」→「毎日の健康習慣に」',
      '「医師推薦」→「多くの方にご愛用」',
      '「完治」→「健康的な生活をサポート」'
    ];

    const baseViolation: TestViolation = {
      id: this.generateId('violation'),
      text: 'がんが治る',
      reason: violationReasons[Math.floor(Math.random() * violationReasons.length)],
      start: 0,
      end: 5,
      suggestions: [suggestions[Math.floor(Math.random() * suggestions.length)]],
      severity: 'high',
      category: '医薬品効果'
    };

    return { ...baseViolation, ...overrides };
  }

  /**
   * チェック結果データの作成
   */
  static createMockCheckResult(
    violationCount = 2,
    overrides: Partial<TestCheckResult> = {}
  ): TestCheckResult {
    const violations = Array.from({ length: violationCount }, (_, index) =>
      this.createMockViolation({
        start: index * 10,
        end: index * 10 + 5
      })
    );

    const baseResult: TestCheckResult = {
      id: this.generateId('check'),
      status: 'completed',
      violations,
      originalText: this.createMockViolationText('medical'),
      processedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 5000).toISOString()
    };

    return { ...baseResult, ...overrides };
  }

  /**
   * APIレスポンス用のモックデータ
   */
  static createMockApiResponse<T>(data: T, success = true): {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  } {
    return success
      ? { success: true, data }
      : { success: false, error: 'テスト用エラー', message: 'モックエラーが発生しました' };
  }

  /**
   * ページネーション付きレスポンスの作成
   */
  static createMockPaginatedResponse<T>(
    items: T[],
    page = 1,
    limit = 10
  ): {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedItems = items.slice(start, end);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 統計データの作成
   */
  static createMockStats(overrides: Record<string, number> = {}): Record<string, number> {
    const baseStats = {
      totalChecks: Math.floor(Math.random() * 10000) + 1000,
      monthlyChecks: Math.floor(Math.random() * 1000) + 100,
      activeUsers: Math.floor(Math.random() * 100) + 10,
      violationsFound: Math.floor(Math.random() * 5000) + 500,
      avgProcessingTime: Math.floor(Math.random() * 5000) + 1000, // ms
      successRate: Math.floor(Math.random() * 20) + 80 // 80-100%
    };

    return { ...baseStats, ...overrides };
  }

  /**
   * テスト環境のリセット（カウンターリセット）
   */
  static resetTestEnvironment(): void {
    this.counter = 0;
  }

  /**
   * 大量データの作成（パフォーマンステスト用）
   */
  static createLargeDataset(size: 'small' | 'medium' | 'large' | 'huge' = 'medium'): {
    users: TestUser[];
    dictionaries: TestDictionaryEntry[];
    checks: TestCheckResult[];
  } {
    const sizes = {
      small: { users: 10, dictionaries: 50, checks: 100 },
      medium: { users: 100, dictionaries: 500, checks: 1000 },
      large: { users: 1000, dictionaries: 5000, checks: 10000 },
      huge: { users: 10000, dictionaries: 50000, checks: 100000 }
    };

    const config = sizes[size];

    return {
      users: this.createMockUsers(config.users),
      dictionaries: this.createMockDictionaries(
        Math.floor(config.dictionaries * 0.8),
        Math.floor(config.dictionaries * 0.2)
      ),
      checks: Array.from({ length: config.checks }, () => this.createMockCheckResult())
    };
  }
}

/**
 * よく使用されるテストデータセットのプリセット
 */
export const TestDataPresets = {
  /**
   * 基本的なユーザーセット
   */
  basicUsers: () => ({
    admin: TestDataFactory.createMockUser('admin', { 
      email: 'admin@test.com',
      firstName: '管理者',
      lastName: 'テスト'
    }),
    user: TestDataFactory.createMockUser('user', {
      email: 'user1@test.com',
      firstName: 'ユーザー',
      lastName: 'テスト'
    })
  }),

  /**
   * 薬機法違反パターン集
   */
  violationPatterns: () => ({
    medical: TestDataFactory.createMockViolationText('medical'),
    exaggerated: TestDataFactory.createMockViolationText('exaggerated'),
    doctor: TestDataFactory.createMockViolationText('doctor'),
    safe: TestDataFactory.createMockViolationText('safe')
  }),

  /**
   * 辞書データセット
   */
  dictionarySet: () => TestDataFactory.createMockDictionaries(20, 10),

  /**
   * エラーテスト用データ
   */
  errorTestData: () => ({
    invalidUser: { email: 'invalid-email', password: 'wrong' },
    expiredToken: 'expired_token_' + Date.now(),
    malformedData: { invalidField: 'invalid_value' }
  })
};