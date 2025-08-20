import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('htmlFor を適用して描画する', () => {
    render(
      <div>
        <Label htmlFor="name">名前</Label>
        <input id="name" />
      </div>
    )
    const label = screen.getByText('名前')
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('for', 'name')
  })
})


