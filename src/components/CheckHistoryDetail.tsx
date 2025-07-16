'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ArrowLeft, Copy, Download, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'

interface Violation {
  id: number
  startPos: number
  endPos: number
  reason: string
  dictionaryPhrase?: string
  dictionaryCategory?: 'NG' | 'ALLOW'
}

interface CheckDetail {
  id: number
  originalText: string
  modifiedText: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt: string | null
  userEmail?: string
  violations: Violation[]
}

interface CheckHistoryDetailProps {
  checkId: number
}

const statusLabels = {
  pending: { label: '待機中', className: 'bg-gray-100 text-gray-800' },
  processing: { label: '処理中', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', className: 'bg-green-100 text-green-800' },
  failed: { label: 'エラー', className: 'bg-red-100 text-red-800' }
}

export default function CheckHistoryDetail({ checkId }: CheckHistoryDetailProps) {
  const [check, setCheck] = useState<CheckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showViolations, setShowViolations] = useState(true)

  useEffect(() => {
    const fetchCheckDetail = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/checks/${checkId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('指定されたチェック履歴が見つかりません')
          }
          if (response.status === 403) {
            throw new Error('このチェック履歴にアクセスする権限がありません')
          }
          throw new Error('チェック履歴の取得に失敗しました')
        }

        const data = await response.json()
        setCheck(data.check)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }

    fetchCheckDetail()
  }, [checkId])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'コピーしました',
        description: `${label}をクリップボードにコピーしました`,
      })
    } catch {
      toast({
        title: 'コピーに失敗しました',
        description: 'クリップボードへのアクセスに失敗しました',
        variant: 'destructive'
      })
    }
  }

  const highlightViolations = (text: string, violations: Violation[]) => {
    if (!showViolations || violations.length === 0) {
      return text
    }

    // Sort violations by start position in descending order to avoid position shifts
    const sortedViolations = [...violations].sort((a, b) => b.startPos - a.startPos)
    
    let highlightedText = text
    sortedViolations.forEach((violation) => {
      const before = highlightedText.substring(0, violation.startPos)
      const violationText = highlightedText.substring(violation.startPos, violation.endPos)
      const after = highlightedText.substring(violation.endPos)
      
      highlightedText = before + 
        `<span class="bg-red-100 text-red-800 px-1 rounded relative" title="${violation.reason}">` +
        violationText +
        '</span>' +
        after
    })

    return highlightedText
  }

  const exportToPDF = () => {
    // Simple PDF export implementation
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>チェック結果 #${check?.id}</title>
          <style>
            body { font-family: "Noto Sans JP", sans-serif; margin: 40px; }
            .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .text-box { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 8px; }
            .original { background-color: #f9f9f9; }
            .modified { background-color: #f0f8ff; }
            .violation { background-color: #fee; color: #c00; padding: 2px 4px; border-radius: 3px; }
            .meta { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>薬機法チェック結果</h1>
            <div class="meta">
              <p>チェック ID: #${check?.id}</p>
              <p>実行日時: ${format(new Date(check?.createdAt ?? ''), 'yyyy年MM月dd日 HH:mm:ss', { locale: ja })}</p>
              ${check?.completedAt ? `<p>完了日時: ${format(new Date(check.completedAt), 'yyyy年MM月dd日 HH:mm:ss', { locale: ja })}</p>` : ''}
              <p>ステータス: ${statusLabels[check?.status ?? 'pending'].label}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>原文</h2>
            <div class="text-box original">
              ${check?.originalText ?? ''}
            </div>
          </div>
          
          ${check?.modifiedText ? `
            <div class="section">
              <h2>修正文</h2>
              <div class="text-box modified">
                ${check.modifiedText}
              </div>
            </div>
          ` : ''}
          
          ${check?.violations && check.violations.length > 0 ? `
            <div class="section">
              <h2>検出された違反</h2>
              <ul>
                ${check.violations.map(v => `
                  <li>
                    <strong>違反箇所:</strong> &quot;${check.originalText.substring(v.startPos, v.endPos)}&quot;<br>
                    <strong>理由:</strong> ${v.reason}
                    ${v.dictionaryPhrase ? `<br><strong>辞書語句:</strong> ${v.dictionaryPhrase}` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">チェック詳細を読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/history">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              履歴一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!check) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">チェック詳細が見つかりません</p>
          <Link href="/history">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              履歴一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              履歴一覧に戻る
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">チェック詳細 #{check.id}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusLabels[check.status].className}>
                {statusLabels[check.status].label}
              </Badge>
              {check.userEmail && (
                <span className="text-sm text-gray-500">{check.userEmail}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowViolations(!showViolations)}
          >
            {showViolations ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                違反を非表示
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                違反を表示
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} data-testid="pdf-download">
            <Download className="h-4 w-4 mr-2" />
            PDF出力
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">作成日時:</span>
              <div>{format(new Date(check.createdAt), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}</div>
            </div>
            {check.completedAt && (
              <div>
                <span className="font-medium text-gray-700">完了日時:</span>
                <div>{format(new Date(check.completedAt), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}</div>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">違反数:</span>
              <div>{check.violations.length}件</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">文字数:</span>
              <div>{check.originalText.length}文字</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="side-by-side" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="side-by-side">並列表示</TabsTrigger>
          <TabsTrigger value="stacked">上下表示</TabsTrigger>
        </TabsList>

        <TabsContent value="side-by-side" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Text */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  原文
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(check.originalText, '原文')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="bg-gray-50 p-4 rounded border min-h-[400px] whitespace-pre-wrap text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: highlightViolations(check.originalText, check.violations)
                  }}
                />
              </CardContent>
            </Card>

            {/* Modified Text */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  修正文
                  {check.modifiedText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(check.modifiedText!, '修正文')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 p-4 rounded border min-h-[400px] whitespace-pre-wrap text-sm leading-relaxed">
                  {check.modifiedText ?? '修正文が生成されていません'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stacked" className="space-y-6">
          {/* Original Text */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                原文
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(check.originalText, '原文')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="bg-gray-50 p-4 rounded border whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: highlightViolations(check.originalText, check.violations)
                }}
              />
            </CardContent>
          </Card>

          {/* Modified Text */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                修正文
                {check.modifiedText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(check.modifiedText!, '修正文')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 p-4 rounded border whitespace-pre-wrap text-sm leading-relaxed">
                {check.modifiedText ?? '修正文が生成されていません'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Violations List */}
      {check.violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>検出された違反 ({check.violations.length}件)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {check.violations.map((violation, index) => (
                <div key={violation.id} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      違反 #{index + 1}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      位置: {violation.startPos}-{violation.endPos}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">違反箇所:</span>
                      <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                        &quot;{check.originalText.substring(violation.startPos, violation.endPos)}&quot;
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">理由:</span>
                      <span className="ml-2 text-sm">{violation.reason}</span>
                    </div>
                    
                    {violation.dictionaryPhrase && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">辞書語句:</span>
                        <span className="ml-2 text-sm">
                          {violation.dictionaryPhrase}
                          {violation.dictionaryCategory && (
                            <Badge 
                              variant="outline" 
                              className={`ml-2 text-xs ${
                                violation.dictionaryCategory === 'NG' 
                                  ? 'border-red-200 text-red-700' 
                                  : 'border-green-200 text-green-700'
                              }`}
                            >
                              {violation.dictionaryCategory}
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}