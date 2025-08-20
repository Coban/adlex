import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect } from 'vitest'

import { Textarea } from '@/components/ui/textarea'

describe('Textareaコンポーネント', () => {
  it('正しくレンダリングされること', () => {
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toBeInTheDocument()
  })

  it('ユーザー入力を適切に処理すること', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    await user.type(textarea, 'Hello World')
    
    expect(textarea).toHaveValue('Hello World')
  })

  it('複数行入力を適切に処理すること', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    await user.type(textarea, 'Line 1{enter}Line 2{enter}Line 3')
    
    expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3')
  })

  it('カスタムclassNameが適用されること', () => {
    render(<Textarea className="custom-class" placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveClass('custom-class')
  })

  it('無効化可能なこと', () => {
    render(<Textarea disabled placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toBeDisabled()
  })

  it('rows属性をサポートすること', () => {
    render(<Textarea rows={5} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('rows', '5')
  })

  it('maxLength属性をサポートすること', () => {
    render(<Textarea maxLength={100} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('maxlength', '100')
  })

  it('refを正しく転送すること', () => {
    const ref = { current: null }
    render(<Textarea ref={ref} placeholder="Test textarea" />)
    
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('フォーカスとブラーイベントを適切に処理すること', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    
    await user.click(textarea)
    expect(textarea).toHaveFocus()
    
    await user.tab()
    expect(textarea).not.toHaveFocus()
  })

  it('制御されたtextareaをサポートすること', async () => {
    const user = userEvent.setup()
    
    function TestComponent() {
      const [value, setValue] = React.useState('')
      const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value)
      }
      
      return <Textarea value={value} onChange={onChange} placeholder="Test textarea" />
    }
    
    render(<TestComponent />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    await user.type(textarea, 'Test')
    
    expect(textarea).toHaveValue('Test')
  })

  it('デフォルトスタイルが適用されること', () => {
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveClass('flex', 'min-h-[80px]', 'w-full', 'rounded-md', 'border')
  })

  it('resizeプロパティを適切に処理すること', () => {
    render(<Textarea style={{ resize: 'vertical' }} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveStyle('resize: vertical')
  })

  it('読み取り専用状態を適切に処理すること', () => {
    render(<Textarea readOnly placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('readonly')
  })

  it('required属性を適切に処理すること', () => {
    render(<Textarea required placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('required')
  })
})