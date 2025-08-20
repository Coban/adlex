import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '@/components/ui/toast'

describe('Toast UI', () => {
  it('タイトルと説明が表示される', () => {
    render(
      <ToastProvider>
        <ToastViewport />
        <Toast open>
          <ToastTitle>タイトル</ToastTitle>
          <ToastDescription>説明</ToastDescription>
        </Toast>
      </ToastProvider>
    )
    expect(screen.getByText('タイトル')).toBeInTheDocument()
    expect(screen.getByText('説明')).toBeInTheDocument()
  })

  it('破壊的バリアントでクラスが付与される', () => {
    const { container } = render(
      <ToastProvider>
        <ToastViewport />
        <Toast open variant="destructive">
          <ToastTitle>危険</ToastTitle>
        </Toast>
      </ToastProvider>
    )
    const root = container.querySelector('[data-state]') ?? container.firstElementChild
    expect(root?.className).toContain('bg-destructive')
  })

  it('アクションとクローズボタンが描画される', () => {
    render(
      <ToastProvider>
        <ToastViewport />
        <Toast open>
          <ToastTitle>操作</ToastTitle>
          <ToastAction altText="undo">戻す</ToastAction>
          <ToastClose aria-label="close" />
        </Toast>
      </ToastProvider>
    )
    expect(screen.getByText('戻す')).toBeInTheDocument()
    expect(screen.getByLabelText('close')).toBeInTheDocument()
  })
})


