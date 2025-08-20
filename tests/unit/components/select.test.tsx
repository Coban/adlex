import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'

describe('Select', () => {
  it('mounts without crashing', () => {
    const { container } = render(
      <Select>
        <SelectTrigger aria-label="select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    )
    expect(container.firstChild).toBeTruthy()
  })
})


