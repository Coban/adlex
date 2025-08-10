import { type ClassValue, clsx } from "clsx"
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja })
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
