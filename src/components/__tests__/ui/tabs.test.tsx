import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs'

describe('Tabs', () => {
  it('renders tabs and content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">タブ1</TabsTrigger>
          <TabsTrigger value="tab2">タブ2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">コンテンツ1</TabsContent>
        <TabsContent value="tab2">コンテンツ2</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('タブ1')).toBeInTheDocument()
    expect(screen.getByText('コンテンツ1')).toBeInTheDocument()
  })
})


