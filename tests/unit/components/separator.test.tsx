import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
  it('renders horizontal separator by default', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />)
    expect(container.firstChild).toBeTruthy()
  })
})


