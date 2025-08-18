'use client'

import { Download, FileText, Table } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { getAllTemplates, getTemplate } from '@/lib/report-templates'

interface CustomReportGeneratorProps {
  selectedCheckIds: number[]
  onClose?: () => void
}

export default function CustomReportGenerator({ selectedCheckIds, onClose }: CustomReportGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [reportConfig, setReportConfig] = useState({
    title: `カスタムレポート ${new Date().toLocaleDateString('ja-JP')}`,
    format: 'pdf' as 'pdf' | 'excel',
    template: 'standard',
    includeStats: true,
    includeSummary: true,
    includeDetails: true,
    description: ''
  })
  
  const templates = getAllTemplates()

  const handleTemplateChange = (templateId: string) => {
    const template = getTemplate(templateId)
    if (template) {
      setReportConfig(prev => ({
        ...prev,
        template: templateId,
        includeStats: template.includeStats,
        includeSummary: template.includeSummary,
        includeDetails: template.includeDetails,
        description: template.description
      }))
    }
  }

  const generateReport = async () => {
    if (selectedCheckIds.length === 0) {
      toast({
        title: 'エラー',
        description: 'レポートに含めるチェックを選択してください',
        variant: 'destructive'
      })
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkIds: selectedCheckIds,
          format: reportConfig.format,
          template: reportConfig.template,
          includeStats: reportConfig.includeStats,
          includeSummary: reportConfig.includeSummary,
          includeDetails: reportConfig.includeDetails,
          title: reportConfig.title,
          description: reportConfig.description
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? 'レポート生成に失敗しました')
      }

      // Download the file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const extension = reportConfig.format === 'pdf' ? 'pdf' : 'xlsx'
      const fileName = `custom_report_${new Date().toISOString().split('T')[0]}.${extension}`
      link.download = fileName
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'レポート生成完了',
        description: 'カスタムレポートをダウンロードしました'
      })

      onClose?.()
    } catch (error) {
      console.error('Report generation error:', error)
      toast({
        title: 'レポート生成エラー',
        description: error instanceof Error ? error.message : '予期しないエラーが発生しました',
        variant: 'destructive'
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          カスタムレポート生成
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="report-title">レポートタイトル</Label>
            <Input
              id="report-title"
              value={reportConfig.title}
              onChange={(e) => setReportConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="レポートのタイトルを入力"
            />
          </div>

          <div>
            <Label htmlFor="report-description">説明（オプション）</Label>
            <Textarea
              id="report-description"
              value={reportConfig.description}
              onChange={(e) => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder="レポートの説明や目的を入力"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="format-select">出力形式</Label>
              <Select
                value={reportConfig.format}
                onValueChange={(value: 'pdf' | 'excel') => 
                  setReportConfig(prev => ({ ...prev, format: value }))
                }
              >
                <SelectTrigger id="format-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF
                    </div>
                  </SelectItem>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      Excel
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="template-select">レポートテンプレート</Label>
              <Select
                value={reportConfig.template}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger id="template-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500">{template.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Content Options */}
        <div className="space-y-3">
          <Label className="text-base font-medium">含める内容</Label>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-stats"
                checked={reportConfig.includeStats}
                onCheckedChange={(checked: boolean) => 
                  setReportConfig(prev => ({ ...prev, includeStats: !!checked }))
                }
              />
              <Label htmlFor="include-stats" className="text-sm">
                統計サマリー
                <span className="text-gray-500 ml-1">（チェック数、完了率、違反数など）</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-summary"
                checked={reportConfig.includeSummary}
                onCheckedChange={(checked: boolean) => 
                  setReportConfig(prev => ({ ...prev, includeSummary: !!checked }))
                }
              />
              <Label htmlFor="include-summary" className="text-sm">
                違反タイプ別サマリー
                <span className="text-gray-500 ml-1">（違反種類の集計）</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-details"
                checked={reportConfig.includeDetails}
                onCheckedChange={(checked: boolean) => 
                  setReportConfig(prev => ({ ...prev, includeDetails: !!checked }))
                }
              />
              <Label htmlFor="include-details" className="text-sm">
                チェック詳細
                <span className="text-gray-500 ml-1">（各チェックの原文、修正文、違反詳細）</span>
              </Label>
            </div>
          </div>
        </div>

        {/* Report Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">レポート情報</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>対象チェック数: {selectedCheckIds.length}件</p>
            <p>出力形式: {reportConfig.format === 'pdf' ? 'PDF' : 'Excel'}</p>
            <p>テンプレート: {getTemplate(reportConfig.template)?.name ?? 'カスタム'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={generateReport}
            disabled={generating || selectedCheckIds.length === 0}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {generating ? 'レポート生成中...' : 'レポート生成'}
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}