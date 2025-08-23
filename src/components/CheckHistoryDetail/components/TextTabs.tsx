import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckDetail } from '../types'
import { TextDisplay } from './TextDisplay'

interface TextTabsProps {
  check: CheckDetail
  showViolations: boolean
  onCopyText: (text: string, label: string) => void
}

export function TextTabs({ check, showViolations, onCopyText }: TextTabsProps) {
  return (
    <Tabs defaultValue="side-by-side" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="side-by-side">並列表示</TabsTrigger>
        <TabsTrigger value="stacked">上下表示</TabsTrigger>
      </TabsList>

      <TabsContent value="side-by-side" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TextDisplay check={check} showViolations={showViolations} onCopyText={onCopyText} />
        </div>
      </TabsContent>

      <TabsContent value="stacked" className="space-y-6">
        <TextDisplay check={check} showViolations={showViolations} onCopyText={onCopyText} />
      </TabsContent>
    </Tabs>
  )
}