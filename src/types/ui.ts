import React from 'react'

// トースト通知の基本型（shadcn/ui Toast用）
export interface ToasterToast {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// トーストアクションの型定義（Reducer用）
export type ActionType =
  | {
      type: "ADD_TOAST"
      toast: ToasterToast
    }
  | {
      type: "UPDATE_TOAST"
      toast: Partial<ToasterToast>
    }
  | {
      type: "DISMISS_TOAST"
      toastId?: ToasterToast["id"]
    }
  | {
      type: "REMOVE_TOAST"
      toastId?: ToasterToast["id"]
    }

// トースト状態の型（useToast hook用）
export interface ToastState {
  toasts: ToasterToast[]
}

// ID無しトースト型（新規作成用）
export interface Toast {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
  variant?: 'default' | 'destructive'
}

// トーストコンポーネントのプロパティ型
export type ToastProps = React.ComponentProps<'div'>

// トーストアクション要素の型
export type ToastActionElement = React.ReactElement