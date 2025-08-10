import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card'

describe('Card', () => {
  it('ヘッダーとコンテンツを描画する', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
        </CardHeader>
        <CardContent>本文</CardContent>
      </Card>
    )
    expect(screen.getByText('タイトル')).toBeInTheDocument()
    expect(screen.getByText('本文')).toBeInTheDocument()
  })
})


