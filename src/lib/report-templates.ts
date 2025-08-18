export interface ReportTemplate {
  id: string
  name: string
  description: string
  includeStats: boolean
  includeSummary: boolean
  includeDetails: boolean
  customSections?: CustomSection[]
}

export interface CustomSection {
  id: string
  title: string
  type: 'text' | 'chart' | 'table'
  content: string
  order: number
}

export const defaultTemplates: ReportTemplate[] = [
  {
    id: 'standard',
    name: '標準レポート',
    description: '基本的な統計とチェック詳細を含むバランスの取れたレポート',
    includeStats: true,
    includeSummary: true,
    includeDetails: true
  },
  {
    id: 'executive',
    name: '管理者向けサマリー',
    description: '統計と概要のみに焦点を当てた高レベルレポート',
    includeStats: true,
    includeSummary: true,
    includeDetails: false
  },
  {
    id: 'detailed',
    name: '詳細分析レポート',
    description: '全ての詳細情報を含む包括的なレポート',
    includeStats: true,
    includeSummary: true,
    includeDetails: true
  },
  {
    id: 'compliance',
    name: 'コンプライアンスレポート',
    description: '法的コンプライアンスのための詳細な違反分析レポート',
    includeStats: true,
    includeSummary: true,
    includeDetails: true,
    customSections: [
      {
        id: 'compliance-summary',
        title: 'コンプライアンス遵守状況',
        type: 'text',
        content: '薬機法に基づく広告表現の適合性評価結果',
        order: 1
      },
      {
        id: 'violation-analysis',
        title: '違反分析',
        type: 'table',
        content: '検出された違反の種類別詳細分析',
        order: 2
      }
    ]
  },
  {
    id: 'monthly',
    name: '月次レポート',
    description: '定期的な監査のための月次集計レポート',
    includeStats: true,
    includeSummary: true,
    includeDetails: false,
    customSections: [
      {
        id: 'monthly-trends',
        title: '月次トレンド',
        type: 'chart',
        content: '違反数の推移とパターン分析',
        order: 1
      }
    ]
  }
]

export function getTemplate(templateId: string): ReportTemplate | null {
  return defaultTemplates.find(template => template.id === templateId) ?? null
}

export function getAllTemplates(): ReportTemplate[] {
  return [...defaultTemplates]
}