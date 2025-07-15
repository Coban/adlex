import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect } from 'vitest'

import { Textarea } from '../../ui/textarea'

describe('Textarea Component', () => {
  it('renders correctly', () => {
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toBeInTheDocument()
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    await user.type(textarea, 'Hello World')
    
    expect(textarea).toHaveValue('Hello World')
  })

  it('handles multiline input', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    await user.type(textarea, 'Line 1{enter}Line 2{enter}Line 3')
    
    expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3')
  })

  it('applies custom className', () => {
    render(<Textarea className="custom-class" placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveClass('custom-class')
  })

  it('can be disabled', () => {
    render(<Textarea disabled placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toBeDisabled()
  })

  it('supports rows attribute', () => {
    render(<Textarea rows={5} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('rows', '5')
  })

  it('supports maxLength attribute', () => {
    render(<Textarea maxLength={100} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('maxlength', '100')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Textarea ref={ref} placeholder="Test textarea" />)
    
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('handles focus and blur events', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    
    await user.click(textarea)
    expect(textarea).toHaveFocus()
    
    await user.tab()
    expect(textarea).not.toHaveFocus()
  })

  it('supports controlled textarea', async () => {
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

  it('applies default styling', () => {
    render(<Textarea placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveClass('flex', 'min-h-[80px]', 'w-full', 'rounded-md', 'border')
  })

  it('handles resize property', () => {
    render(<Textarea style={{ resize: 'vertical' }} placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveStyle('resize: vertical')
  })

  it('handles readonly state', () => {
    render(<Textarea readOnly placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('readonly')
  })

  it('handles required attribute', () => {
    render(<Textarea required placeholder="Test textarea" />)
    
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea).toHaveAttribute('required')
  })
})