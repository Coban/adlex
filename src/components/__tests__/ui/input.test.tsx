import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, it, expect } from 'vitest'

import { Input } from '../../ui/input'

describe('Input Component', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toBeInTheDocument()
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    await user.type(input, 'Hello World')
    
    expect(input).toHaveValue('Hello World')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveClass('custom-class')
  })

  it('can be disabled', () => {
    render(<Input disabled placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toBeDisabled()
  })

  it('supports different input types', () => {
    render(<Input type="email" placeholder="Email" />)
    
    const input = screen.getByPlaceholderText('Email')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Input ref={ref} placeholder="Test input" />)
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('handles focus and blur events', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    
    await user.click(input)
    expect(input).toHaveFocus()
    
    await user.tab()
    expect(input).not.toHaveFocus()
  })

  it('supports controlled input', async () => {
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

  it('applies default styling', () => {
    render(<Input placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border')
  })

  it('handles invalid state styling', () => {
    render(<Input aria-invalid="true" placeholder="Test input" />)
    
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})