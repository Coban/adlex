import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect } from 'vitest'

import { Input } from '@/components/ui/input'

describe('Inputコンポーネント', () => {
  it('正しくレンダリングされること', () => {
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toBeInTheDocument()
  })

  it('ユーザー入力を適切に処理すること', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    await user.type(input, 'Hello World')
    
    expect(input).toHaveValue('Hello World')
  })

  it('カスタムclassNameが適用されること', () => {
    render(<Input className="custom-class" placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveClass('custom-class')
  })

  it('無効化可能なこと', () => {
    render(<Input disabled placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toBeDisabled()
  })

  it('異なる入力タイプをサポートすること', () => {
    render(<Input type="email" placeholder="Email" />)
    
    const input = screen.getByPlaceholderText('Email')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('refを正しく転送すること', () => {
    const ref = { current: null }
    render(<Input ref={ref} placeholder="Test input" />)
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('フォーカスとブラーイベントを適切に処理すること', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    
    await user.click(input)
    expect(input).toHaveFocus()
    
    await user.tab()
    expect(input).not.toHaveFocus()
  })

  it('制御された入力をサポートすること', async () => {
    const user = userEvent.setup()
    
    function TestComponent() {
      const [value, setValue] = React.useState('')
      const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value)
      }
      
      return <Input value={value} onChange={onChange} placeholder="Test input" />
    }
    
    render(<TestComponent />)
    
    const input = screen.getByPlaceholderText('Test input')
    await user.type(input, 'Test')
    
    expect(input).toHaveValue('Test')
  })

  it('デフォルトスタイルが適用されること', () => {
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border')
  })

  it('無効な状態のスタイルを適切に処理すること', () => {
    render(<Input aria-invalid="true" placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})