import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { CheckDetail, Violation } from '../types'
import { extractViolationText } from '../utils/violationHighlighting'

interface ViolationsListProps {
  check: CheckDetail
}

export function ViolationsList({ check }: ViolationsListProps) {
  if (check.violations.length === 0) return null

  return (
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
                    &quot;{extractViolationText(check.originalText, violation)}&quot;
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
  )
}