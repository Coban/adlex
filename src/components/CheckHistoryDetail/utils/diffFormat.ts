/**
 * diff フォーマット生成ユーティリティ
 */

/**
 * diff フォーマットのヘッダー生成
 */
export function getDiffHeader(originalLineCount: number, modifiedLineCount: number): string {
  return `--- 原文
+++ 修正文
@@ -1,${originalLineCount} +1,${modifiedLineCount} @@`
}

/**
 * diff フォーマットの本文生成
 */
export function getDiffBody(originalText: string, modifiedText: string): string {
  const originalLines = originalText.split('\n').map(line => `-${line}`).join('\n')
  const modifiedLines = modifiedText.split('\n').map(line => `+${line}`).join('\n')
  return `${originalLines}\n${modifiedLines}`
}

/**
 * 完全なdiff形式テキストを生成
 */
export function generateDiffFormat(originalText: string, modifiedText: string): string {
  const diffHeader = getDiffHeader(originalText.split('\n').length, modifiedText.split('\n').length)
  const diffBody = getDiffBody(originalText, modifiedText)
  return `${diffHeader}\n${diffBody}`
}