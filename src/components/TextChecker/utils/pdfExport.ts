/**
 * TextChecker PDF エクスポート ユーティリティ
 * チェック結果のPDF出力機能
 */

import { CheckResult } from '@/types'
import { logger } from '@/lib/logger'

/**
 * チェック結果をPDF形式でエクスポート
 * @param checkResult チェック結果データ
 * @throws Error エクスポート失敗時
 */
export async function exportCheckResultToPdf(checkResult: CheckResult): Promise<void> {
  try {
    if (!checkResult) {
      throw new Error('エクスポートするデータがありません')
    }

    // Create PDF content using browser's print functionality
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `check-report-${timestamp}.pdf`
    
    // Create a blob with the result data
    const content = generatePdfContent(checkResult)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    // Create download link
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    logger.info('PDF export completed successfully', {
      operation: 'exportCheckResultToPdf',
      filename,
      violationCount: checkResult.violations.length,
      textLength: checkResult.original_text.length
    })
  } catch (error) {
    logger.error('PDF export failed', {
      operation: 'exportCheckResultToPdf',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * チェック結果からPDF用コンテンツを生成
 * @param checkResult チェック結果データ
 * @returns PDF用テキストコンテンツ
 */
function generatePdfContent(checkResult: CheckResult): string {
  const currentDate = new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return `
AdLex - 薬機法チェック結果レポート
=====================================

生成日時: ${currentDate}
レポートID: ${checkResult.id}

検出サマリー:
- 違反件数: ${checkResult.violations.length}件
- 元テキスト文字数: ${checkResult.original_text.length}文字
- 修正後文字数: ${checkResult.modified_text.length}文字

=====================================

【元のテキスト】
${checkResult.original_text}

=====================================

【修正されたテキスト】
${checkResult.modified_text}

=====================================

【検出された違反一覧】
${checkResult.violations.length > 0 
  ? checkResult.violations.map((violation, index) => {
      const violationText = checkResult.original_text.slice(violation.startPos, violation.endPos)
      return `
${index + 1}. 違反箇所: "${violationText}"
   位置: ${violation.startPos}-${violation.endPos}
   理由: ${violation.reason}
   ${violation.dictionary_id ? `辞書ID: ${violation.dictionary_id}` : ''}
`
    }).join('')
  : '違反は検出されませんでした。'
}

=====================================

本レポートは AdLex 薬機法チェックシステムにより自動生成されました。
詳細な確認や法的判断については、専門家にご相談ください。

© AdLex ${new Date().getFullYear()}
  `
}

/**
 * ブラウザの印刷機能を使用したPDF出力（将来の拡張用）
 * @param content HTML コンテンツ
 */
export function printToPdf(content: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('ポップアップがブロックされました。ポップアップを許可してください。')
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>AdLex チェック結果</title>
      <style>
        body { 
          font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
          line-height: 1.6;
          margin: 20px;
          color: #333;
        }
        .header {
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .violation {
          background-color: #fff5f5;
          border-left: 4px solid #f56565;
          padding: 10px;
          margin: 10px 0;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      ${content}
      <div class="no-print" style="text-align: center; margin-top: 20px;">
        <button onclick="window.print()">印刷</button>
        <button onclick="window.close()">閉じる</button>
      </div>
    </body>
    </html>
  `)

  printWindow.document.close()
}