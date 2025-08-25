import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { CheckDetail } from '../types'
import { highlightViolations } from '../utils/violationHighlighting'

interface TextDisplayProps {
  check: CheckDetail
  showViolations: boolean
  onCopyText: (text: string, label: string) => void
}

export function TextDisplay({ check, showViolations, onCopyText }: TextDisplayProps) {
  return (
    <>
      {/* Original Text */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            原文
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyText(check.originalText, '原文')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="bg-gray-50 dark:bg-gray-800 dark:text-gray-100 p-4 rounded border min-h-[400px] whitespace-pre-wrap text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: highlightViolations(check.originalText, check.violations, showViolations)
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
                onClick={() => onCopyText(check.modifiedText!, '修正文')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 dark:bg-blue-900 dark:text-blue-100 p-4 rounded border min-h-[400px] whitespace-pre-wrap text-sm leading-relaxed">
            {check.modifiedText ?? '修正文が生成されていません'}
          </div>
        </CardContent>
      </Card>
    </>
  )
}