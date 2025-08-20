'use client'

import { 
  MessageSquare, 
  HelpCircle, 
  FileText, 
  PlayCircle,
  Search,
  ChevronRight,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useState } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface SupportTicket {
  id: string
  subject: string
  user: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  lastUpdated: string
  category: string
}

const faqs = [
  {
    category: '基本機能',
    questions: [
      {
        q: 'AdLexとは何ですか？',
        a: 'AdLexは薬機法に準拠した広告テキストの自動チェックツールです。AIを活用して違反可能性のある表現を検出し、修正案を提案します。'
      },
      {
        q: 'テキストチェックの仕組みは？',
        a: 'テキストを入力すると、AIが薬機法違反の可能性がある表現を自動検出します。違反箇所はハイライト表示され、修正案も同時に提示されます。'
      },
      {
        q: '画像からのテキスト抽出は可能ですか？',
        a: 'はい、画像をアップロードすることでOCR機能により自動的にテキストを抽出し、チェックを実行できます。'
      }
    ]
  },
  {
    category: '料金・プラン',
    questions: [
      {
        q: '料金プランについて教えてください',
        a: '組織の規模に応じた複数のプランをご用意しています。詳細は料金ページをご確認ください。'
      },
      {
        q: '無料トライアルはありますか？',
        a: '14日間の無料トライアルをご利用いただけます。全機能をお試しいただけます。'
      },
      {
        q: '支払い方法は？',
        a: 'クレジットカード、銀行振込に対応しています。年払いの場合は割引も適用されます。'
      }
    ]
  },
  {
    category: 'セキュリティ',
    questions: [
      {
        q: 'データの安全性は？',
        a: 'すべてのデータは暗号化され、セキュアな環境で保管されます。ISO27001準拠のセキュリティ対策を実施しています。'
      },
      {
        q: 'チェックしたテキストは保存されますか？',
        a: 'チェック履歴として保存されますが、いつでも削除可能です。データは組織単位で管理され、他の組織からはアクセスできません。'
      }
    ]
  },
  {
    category: 'トラブルシューティング',
    questions: [
      {
        q: 'チェックが完了しない場合',
        a: 'ネットワーク接続を確認し、ページを再読み込みしてください。問題が続く場合はサポートまでご連絡ください。'
      },
      {
        q: 'ログインできない場合',
        a: 'パスワードリセット機能をご利用ください。メールアドレスに再設定用のリンクが送信されます。'
      },
      {
        q: 'エラーが表示される場合',
        a: 'エラーメッセージをスクリーンショットで保存し、サポートチームまでご連絡ください。'
      }
    ]
  }
]

const tutorials = [
  {
    title: '初めての薬機法チェック',
    description: 'AdLexの基本的な使い方を5分で学ぶ',
    duration: '5分',
    level: '初級'
  },
  {
    title: '辞書機能の活用方法',
    description: 'カスタム辞書を作成して精度を向上させる',
    duration: '10分',
    level: '中級'
  },
  {
    title: 'APIの使い方',
    description: 'APIを使った自動化の実装方法',
    duration: '15分',
    level: '上級'
  },
  {
    title: '管理者向けガイド',
    description: '組織管理とユーザー権限の設定',
    duration: '8分',
    level: '管理者'
  }
]

export default function AdminSupport() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [tickets] = useState<SupportTicket[]>([
    {
      id: '1',
      subject: 'チェック機能が動作しない',
      user: 'user1@test.com',
      status: 'open',
      priority: 'high',
      createdAt: '2024-01-20T10:00:00',
      lastUpdated: '2024-01-20T10:00:00',
      category: 'technical'
    },
    {
      id: '2',
      subject: '辞書の一括登録について',
      user: 'user2@test.com',
      status: 'in_progress',
      priority: 'medium',
      createdAt: '2024-01-19T15:30:00',
      lastUpdated: '2024-01-20T09:00:00',
      category: 'feature'
    },
    {
      id: '3',
      subject: '請求書の発行依頼',
      user: 'admin@test.com',
      status: 'resolved',
      priority: 'low',
      createdAt: '2024-01-18T14:00:00',
      lastUpdated: '2024-01-19T11:00:00',
      category: 'billing'
    }
  ])

  const getStatusBadge = (status: SupportTicket['status']) => {
    const variants: Record<SupportTicket['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
      open: 'destructive',
      in_progress: 'secondary',
      resolved: 'default',
      closed: 'outline'
    }
    const labels: Record<SupportTicket['status'], string> = {
      open: '未対応',
      in_progress: '対応中',
      resolved: '解決済',
      closed: 'クローズ'
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const getPriorityBadge = (priority: SupportTicket['priority']) => {
    const colors: Record<SupportTicket['priority'], string> = {
      urgent: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-yellow-600',
      low: 'text-green-600'
    }
    const labels: Record<SupportTicket['priority'], string> = {
      urgent: '緊急',
      high: '高',
      medium: '中',
      low: '低'
    }
    return (
      <span className={`text-xs font-medium ${colors[priority]}`}>
        優先度: {labels[priority]}
      </span>
    )
  }

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => searchQuery === '' || 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">サポートセンター</h1>
          <p className="text-muted-foreground">ヘルプ、FAQ、サポートチケット管理</p>
        </div>
      </div>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList className="grid w-full max-w-[600px] grid-cols-4">
          <TabsTrigger value="tickets">チケット</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="docs">ドキュメント</TabsTrigger>
          <TabsTrigger value="contact">お問い合わせ</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                サポートチケット
              </CardTitle>
              <CardDescription>ユーザーからの問い合わせ管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* チケットフィルター */}
                <div className="flex gap-2">
                  <Button 
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                  >
                    すべて
                  </Button>
                  <Button 
                    variant={selectedCategory === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('open')}
                  >
                    未対応
                  </Button>
                  <Button 
                    variant={selectedCategory === 'in_progress' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('in_progress')}
                  >
                    対応中
                  </Button>
                  <Button 
                    variant={selectedCategory === 'resolved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('resolved')}
                  >
                    解決済
                  </Button>
                </div>

                {/* チケット一覧 */}
                <div className="space-y-3">
                  {tickets
                    .filter(t => selectedCategory === 'all' || t.status === selectedCategory)
                    .map((ticket) => (
                    <div key={ticket.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{ticket.subject}</h4>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {ticket.user}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(ticket.createdAt).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                よくある質問
              </CardTitle>
              <CardDescription>頻繁に寄せられる質問と回答</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 検索バー */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="質問を検索..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* FAQ一覧 */}
                {filteredFaqs.map((category) => (
                  <div key={category.category}>
                    <h3 className="font-semibold mb-3">{category.category}</h3>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.category}-${index}`}>
                          <AccordionTrigger className="text-left">
                            {faq.q}
                          </AccordionTrigger>
                          <AccordionContent>
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                ドキュメント & チュートリアル
              </CardTitle>
              <CardDescription>使い方ガイドとチュートリアル動画</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tutorials.map((tutorial, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <h4 className="font-medium flex items-center gap-2">
                          <PlayCircle className="h-4 w-4 text-primary" />
                          {tutorial.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {tutorial.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {tutorial.duration}
                          </span>
                          <Badge variant="secondary">{tutorial.level}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">その他のリソース</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <a href="#" className="hover:underline">APIドキュメント</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <a href="#" className="hover:underline">管理者ガイド</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <a href="#" className="hover:underline">薬機法ガイドライン</a>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                お問い合わせフォーム
              </CardTitle>
              <CardDescription>サポートチームへ直接お問い合わせください</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">お名前</Label>
                    <Input id="name" placeholder="山田 太郎" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input id="email" type="email" placeholder="example@company.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">カテゴリー</Label>
                  <select 
                    id="category"
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">選択してください</option>
                    <option value="technical">技術的な問題</option>
                    <option value="feature">機能リクエスト</option>
                    <option value="billing">請求・支払い</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">優先度</Label>
                  <select 
                    id="priority"
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">緊急</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">件名</Label>
                  <Input id="subject" placeholder="お問い合わせの件名" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">お問い合わせ内容</Label>
                  <Textarea 
                    id="message" 
                    placeholder="詳細な内容をご記入ください..."
                    rows={6}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline">キャンセル</Button>
                  <Button type="submit">送信</Button>
                </div>
              </form>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  お問い合わせの前に
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• FAQセクションで同様の質問がないか確認してください</li>
                  <li>• エラーの場合は、スクリーンショットを添付してください</li>
                  <li>• 営業時間：平日 9:00-18:00（土日祝を除く）</li>
                  <li>• 回答まで最大2営業日かかる場合があります</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}