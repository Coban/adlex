import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { useToast } from '@/hooks/use-toast'

describe('useToast', () => {
  it('toast追加とdismissが動く', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())

    // 初期は空
    expect(result.current.toasts.length).toBe(0)

    // 追加
    act(() => {
      result.current.toast({ title: 't1', description: 'd1' })
    })
    expect(result.current.toasts.length).toBe(1)
    const id = result.current.toasts[0].id

    // dismiss
    act(() => {
      result.current.dismiss(id)
      // 自動削除は長い遅延だが、状態は open: false になる
    })
    expect(result.current.toasts[0].open).toBe(false)

    vi.useRealTimers()
  })
})


