import Link from 'next/link'
import { ArrowLeft, Copy, Download, Eye, EyeOff, RefreshCw, Trash2, ImageIcon, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckDetail, statusLabels } from '../types'

interface CheckHeaderProps {
  check: CheckDetail
  showViolations: boolean
  onToggleViolations: () => void
  onRerun: () => void
  onCopyDiff: () => void
  onPdfDownload: () => void
  onDelete: () => void
}

export function CheckHeader({
  check,
  showViolations,
  onToggleViolations,
  onRerun,
  onCopyDiff,
  onPdfDownload,
  onDelete,
}: CheckHeaderProps) {
  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600" data-testid="breadcrumb">
        <Link href="/" className="hover:text-gray-900 transition-colors" data-testid="breadcrumb-home">
          ホーム
        </Link>
        <span>/</span>
        <Link href="/history" className="hover:text-gray-900 transition-colors" data-testid="breadcrumb-history">
          チェック履歴
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium" data-testid="breadcrumb-current">
          詳細
        </span>
      </nav>

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
              <Badge variant="outline" className="flex items-center gap-1">
                {check.inputType === 'image' ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {check.inputType === 'image' ? '画像' : 'テキスト'}
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
            onClick={onToggleViolations}
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
          <Button
            variant="outline"
            size="sm"
            onClick={onRerun}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            再実行
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyDiff}
            disabled={!check.modifiedText}
            data-testid="diff-copy"
          >
            <Copy className="h-4 w-4 mr-2" />
            diff形式コピー
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onPdfDownload}
            data-testid="pdf-download"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF出力
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            削除
          </Button>
        </div>
      </div>
    </>
  )
}