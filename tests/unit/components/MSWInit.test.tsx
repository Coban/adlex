import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import MSWInit from '@/components/MSWInit'

describe('MSWInit', () => {
  it('クライアントでマウントしても何も描画しない', () => {
    const { container } = render(<MSWInit />)
    expect(container.firstChild).toBeNull()
  })
})


