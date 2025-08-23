/**
 * TextChecker チェック結果表示コンポーネント
 * チェック結果の表示、コピー、エクスポート機能を管理
 */

import { Copy, Download } from 'lucide-react'
import React, { useRef, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckItem } from '@/types'

export interface CheckResultsProps {
  check: CheckItem
  onCopy: (text: string) => void
  onExport: () => void
  copySuccess: string | null
  pdfError: string | null
  highlightText: (text: string, violations: any[], selectedId: number | null) => string
  selectedViolationId: number | null
  onViolationSelect: (id: number | null) => void
  dictionaryInfo: { [key: number]: { phrase: string; category: 'NG' | 'ALLOW'; notes: string | null } }
}

export const CheckResults: React.FC<CheckResultsProps> = ({
  check,
  onCopy,
  onExport,
  copySuccess,
  pdfError,
  highlightText,
  selectedViolationId,
  onViolationSelect,
  dictionaryInfo
}) => {
  const originalTextRef = useRef<HTMLDivElement | null>(null)

  // 違反テキストクリック処理
  useEffect(() => {
    const el = originalTextRef.current
    if (!el) return

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const span = target.closest('.violation-span') as HTMLElement | null
      if (span?.dataset.vid) {
        const vid = Number(span.dataset.vid)
        if (!Number.isNaN(vid)) onViolationSelect(vid)
      }
    }

    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [onViolationSelect])

  const result = check.result
  if (!result) return null

  return (
    <div className="space-y-6">
      {/* メタ情報 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">チェック結果</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">検出違反数:</span>
            <span className="ml-2 font-medium">{result.violations.length}件</span>
          </div>
          <div>
            <span className="text-gray-600">文字数:</span>
            <span className="ml-2 font-medium">{result.original_text.length}文字</span>
          </div>
        </div>
      </div>

      {/* タブ表示 */}
      <Tabs defaultValue="original" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="original">元のテキスト</TabsTrigger>
          <TabsTrigger value="modified">修正テキスト</TabsTrigger>
        </TabsList>

        {/* 元のテキスト */}
        <TabsContent value="original" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(result.original_text)}
            >
              <Copy className="w-4 h-4 mr-2" />
              コピー
            </Button>
          </div>
          
          <div 
            ref={originalTextRef}
            className="p-4 border rounded-lg bg-white whitespace-pre-wrap font-mono text-sm leading-relaxed cursor-pointer"
            dangerouslySetInnerHTML={{
              __html: highlightText(result.original_text, result.violations, selectedViolationId)
            }}
            data-testid="original-text"
          />
        </TabsContent>

        {/* 修正テキスト */}
        <TabsContent value="modified" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(result.modified_text)}
            >
              <Copy className="w-4 h-4 mr-2" />
              コピー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF出力
            </Button>
          </div>
          
          <div className="p-4 border rounded-lg bg-white whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {result.modified_text}
          </div>
        </TabsContent>
      </Tabs>

      {/* 違反一覧 */}
      {result.violations.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold">検出された違反 ({result.violations.length}件)</h4>
          <div className="space-y-3">
            {result.violations.map((violation, index) => {
              const violationText = result.original_text.slice(violation.startPos, violation.endPos)
              const dict = violation.dictionary_id ? dictionaryInfo[violation.dictionary_id] : null
              const isSelected = selectedViolationId === violation.id

              return (
                <div
                  key={violation.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => onViolationSelect(isSelected ? null : violation.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">違反 {index + 1}</span>
                    {dict && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        dict.category === 'NG' 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : 'bg-green-100 text-green-800 border-green-200'
                      }`}>
                        {dict.category}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">問題のテキスト:</span>
                      <code className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                        {violationText}
                      </code>
                    </div>
                    
                    <div>
                      <span className="text-sm text-gray-600">理由:</span>
                      <span className="ml-2 text-sm">{violation.reason}</span>
                    </div>

                    {dict && dict.notes && (
                      <div>
                        <span className="text-sm text-gray-600">補足:</span>
                        <span className="ml-2 text-sm text-gray-700">{dict.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* フィードバック表示 */}
      {pdfError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md" data-testid="pdf-error">
          <p className="text-red-800 text-sm">{pdfError}</p>
        </div>
      )}

      {copySuccess && (
        <div className={`p-3 border rounded-md ${
          copySuccess.includes('手動') 
            ? 'bg-yellow-50 border-yellow-200' 
            : 'bg-green-50 border-green-200'
        }`} data-testid={copySuccess.includes('手動') ? 'copy-fallback' : 'copy-success'}>
          <p className={`text-sm ${
            copySuccess.includes('手動') ? 'text-yellow-800' : 'text-green-800'
          }`}>
            {copySuccess}
          </p>
        </div>
      )}
    </div>
  )
}