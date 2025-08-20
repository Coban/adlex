import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import { Button } from '@/components/ui/button'

describe('Buttonコンポーネント', () => {
  it('テキスト付きボタンがレンダリングされること', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Click me')
  })

  it('クリックイベントを適切に処理すること', async () => {
    const user = userEvent.setup()
    let clicked = false
    const handleClick = () => { clicked = true }
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button')
    await user.click(button)
    
    expect(clicked).toBe(true)
  })

  it('disabledプロプがtrueの場合無効化されること', () => {
    render(<Button disabled>Disabled button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('バリアントクラスが正しく適用されること', () => {
    render(<Button variant="destructive">Delete</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('サイズクラスが正しく適用されること', () => {
    render(<Button size="sm">Small button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-9')
  })

  it('asChildがtrueの場合子要素としてレンダリングされること', () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    )
    
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('追加プロプを適切に転送すること', () => {
    render(<Button data-testid="custom-button">Test</Button>)
    
    const button = screen.getByTestId('custom-button')
    expect(button).toBeInTheDocument()
  })

  it('カスタムclassNameがバリアントクラスとともに適用されること', () => {
    render(<Button className="custom-class">Custom</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
    expect(button).toHaveClass('bg-primary') // Default variant class
  })
}) 