import { type ClassValue, clsx } from "clsx"
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { twMerge } from "tailwind-merge"

/**
 * Tailwindクラス名を結合し、重複や競合を解決して返す。
 *
 * @param inputs クラス名の配列（真偽混在可）
 * @returns 結合済みクラス名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 日時を `yyyy/MM/dd HH:mm` 形式（日本語ロケール）でフォーマットする。
 *
 * @param date 日付文字列またはDate
 * @returns フォーマット済み文字列
 */
export function formatDate(date: string | Date) {
  return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja })
}

/**
 * 指定長を超えるテキストを省略記号付きで切り詰める。
 *
 * @param text 入力テキスト
 * @param maxLength 最大長
 * @returns 切り詰め済みテキスト
 */
export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
