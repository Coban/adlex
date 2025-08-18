'use client'

import { 
  Settings, 
  Flag, 
  Bell, 
  Key,
  AlertTriangle,
  Save,
  RefreshCw,
  Database,
  Zap
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
  category: 'experimental' | 'beta' | 'stable'
  lastModified: string
}

interface SystemConfig {
  maintenanceMode: boolean
  maintenanceMessage: string
  debugMode: boolean
  rateLimitEnabled: boolean
  rateLimitRequests: number
  rateLimitWindow: number
  cacheEnabled: boolean
  cacheTTL: number
  maxUploadSize: number
  allowedFileTypes: string[]
}

interface NotificationSettings {
  emailNotifications: boolean
  slackIntegration: boolean
  slackWebhookUrl: string
  errorAlerts: boolean
  performanceAlerts: boolean
  securityAlerts: boolean
}

export default function SystemSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 機能フラグ
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
    {
      id: '1',
      name: 'AI自動学習',
      description: 'チェック結果から自動的に辞書を改善する機能',
      enabled: false,
      category: 'experimental',
      lastModified: '2024-01-20'
    },
    {
      id: '2',
      name: 'バッチ処理API',
      description: '複数テキストの一括チェックAPI',
      enabled: true,
      category: 'beta',
      lastModified: '2024-01-18'
    },
    {
      id: '3',
      name: '多言語対応',
      description: '英語・中国語での薬機法チェック',
      enabled: false,
      category: 'experimental',
      lastModified: '2024-01-15'
    },
    {
      id: '4',
      name: 'リアルタイムコラボレーション',
      description: '複数ユーザーでの同時編集機能',
      enabled: false,
      category: 'experimental',
      lastModified: '2024-01-10'
    },
    {
      id: '5',
      name: 'カスタムレポート',
      description: 'ユーザー定義のレポート生成機能',
      enabled: true,
      category: 'stable',
      lastModified: '2024-01-05'
    }
  ])

  // システム設定
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    maintenanceMode: false,
    maintenanceMessage: 'システムメンテナンス中です。しばらくお待ちください。',
    debugMode: false,
    rateLimitEnabled: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60,
    cacheEnabled: true,
    cacheTTL: 3600,
    maxUploadSize: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
  })

  // 通知設定
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    slackIntegration: false,
    slackWebhookUrl: '',
    errorAlerts: true,
    performanceAlerts: true,
    securityAlerts: true
  })

  // API設定
  const [apiKeys] = useState([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk-prod-xxxx...xxxx',
      created: '2024-01-01',
      lastUsed: '2024-01-20',
      status: 'active'
    },
    {
      id: '2',
      name: 'Development API Key',
      key: 'sk-dev-yyyy...yyyy',
      created: '2024-01-10',
      lastUsed: '2024-01-19',
      status: 'active'
    }
  ])

  const toggleFeatureFlag = (id: string) => {
    setFeatureFlags(prev => prev.map(flag => 
      flag.id === id 
        ? { ...flag, enabled: !flag.enabled, lastModified: new Date().toISOString().split('T')[0] }
        : flag
    ))
  }

  const saveSystemConfig = async () => {
    setSaving(true)
    try {
      // ここで実際のAPIコールを行う
      await new Promise(resolve => setTimeout(resolve, 1000)) // シミュレーション
      
      toast({
        title: '設定を保存しました',
        description: 'システム設定が正常に更新されました。',
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: 'エラー',
        description: '設定の保存に失敗しました。',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const clearCache = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)) // シミュレーション
      toast({
        title: 'キャッシュをクリアしました',
        description: 'システムキャッシュが正常にクリアされました。',
      })
    } catch (error) {
      console.error('Cache clear error:', error)
      toast({
        title: 'エラー',
        description: 'キャッシュのクリアに失敗しました。',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getCategoryBadge = (category: FeatureFlag['category']) => {
    const variants: Record<FeatureFlag['category'], 'default' | 'secondary' | 'outline'> = {
      experimental: 'outline',
      beta: 'secondary',
      stable: 'default'
    }
    return <Badge variant={variants[category]}>{category}</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">システム設定</h1>
          <p className="text-muted-foreground">システム全体の設定と機能管理</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full max-w-[800px] grid-cols-5">
          <TabsTrigger value="general">一般</TabsTrigger>
          <TabsTrigger value="features">機能フラグ</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="maintenance">メンテナンス</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                一般設定
              </CardTitle>
              <CardDescription>システムの基本動作設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* レート制限 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">レート制限</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>レート制限を有効化</Label>
                    <p className="text-sm text-muted-foreground">APIリクエストの制限を設定</p>
                  </div>
                  <Switch 
                    checked={systemConfig.rateLimitEnabled}
                    onCheckedChange={(checked: boolean) => 
                      setSystemConfig(prev => ({ ...prev, rateLimitEnabled: checked }))
                    }
                  />
                </div>
                {systemConfig.rateLimitEnabled && (
                  <div className="grid grid-cols-2 gap-4 pl-4">
                    <div className="space-y-2">
                      <Label>リクエスト数</Label>
                      <Input 
                        type="number"
                        value={systemConfig.rateLimitRequests}
                        onChange={(e) => 
                          setSystemConfig(prev => ({ ...prev, rateLimitRequests: parseInt(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>時間枠（秒）</Label>
                      <Input 
                        type="number"
                        value={systemConfig.rateLimitWindow}
                        onChange={(e) => 
                          setSystemConfig(prev => ({ ...prev, rateLimitWindow: parseInt(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* キャッシュ設定 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">キャッシュ設定</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>キャッシュを有効化</Label>
                    <p className="text-sm text-muted-foreground">APIレスポンスのキャッシュ</p>
                  </div>
                  <Switch 
                    checked={systemConfig.cacheEnabled}
                    onCheckedChange={(checked: boolean) => 
                      setSystemConfig(prev => ({ ...prev, cacheEnabled: checked }))
                    }
                  />
                </div>
                {systemConfig.cacheEnabled && (
                  <div className="space-y-2 pl-4">
                    <Label>キャッシュ有効期限（秒）</Label>
                    <Input 
                      type="number"
                      value={systemConfig.cacheTTL}
                      onChange={(e) => 
                        setSystemConfig(prev => ({ ...prev, cacheTTL: parseInt(e.target.value) }))
                      }
                    />
                  </div>
                )}
                <Button 
                  variant="outline" 
                  onClick={clearCache}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  キャッシュをクリア
                </Button>
              </div>

              {/* ファイルアップロード設定 */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">ファイルアップロード</h3>
                <div className="space-y-2">
                  <Label>最大ファイルサイズ（MB）</Label>
                  <Input 
                    type="number"
                    value={systemConfig.maxUploadSize}
                    onChange={(e) => 
                      setSystemConfig(prev => ({ ...prev, maxUploadSize: parseInt(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>許可するファイル形式</Label>
                  <Input 
                    value={systemConfig.allowedFileTypes.join(', ')}
                    onChange={(e) => 
                      setSystemConfig(prev => ({ 
                        ...prev, 
                        allowedFileTypes: e.target.value.split(',').map(s => s.trim())
                      }))
                    }
                    placeholder="jpg, png, pdf"
                  />
                </div>
              </div>

              <Button onClick={saveSystemConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : '設定を保存'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                機能フラグ管理
              </CardTitle>
              <CardDescription>実験的機能やベータ機能の有効化/無効化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.map((flag) => (
                  <div key={flag.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{flag.name}</h4>
                          {getCategoryBadge(flag.category)}
                        </div>
                        <p className="text-sm text-muted-foreground">{flag.description}</p>
                        <p className="text-xs text-muted-foreground">
                          最終更新: {flag.lastModified}
                        </p>
                      </div>
                      <Switch 
                        checked={flag.enabled}
                        onCheckedChange={() => toggleFeatureFlag(flag.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知設定
              </CardTitle>
              <CardDescription>アラートと通知の設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>メール通知</Label>
                    <p className="text-sm text-muted-foreground">重要なイベントをメールで通知</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked: boolean) => 
                      setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Slack連携</Label>
                    <p className="text-sm text-muted-foreground">SlackチャンネルへA通知を送信</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.slackIntegration}
                    onCheckedChange={(checked: boolean) => 
                      setNotificationSettings(prev => ({ ...prev, slackIntegration: checked }))
                    }
                  />
                </div>

                {notificationSettings.slackIntegration && (
                  <div className="space-y-2 pl-4">
                    <Label>Slack Webhook URL</Label>
                    <Input 
                      type="url"
                      value={notificationSettings.slackWebhookUrl}
                      onChange={(e) => 
                        setNotificationSettings(prev => ({ ...prev, slackWebhookUrl: e.target.value }))
                      }
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                )}

                <h3 className="text-sm font-medium pt-4">アラート設定</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>エラーアラート</Label>
                    <Switch 
                      checked={notificationSettings.errorAlerts}
                      onCheckedChange={(checked: boolean) => 
                        setNotificationSettings(prev => ({ ...prev, errorAlerts: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>パフォーマンスアラート</Label>
                    <Switch 
                      checked={notificationSettings.performanceAlerts}
                      onCheckedChange={(checked: boolean) => 
                        setNotificationSettings(prev => ({ ...prev, performanceAlerts: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>セキュリティアラート</Label>
                    <Switch 
                      checked={notificationSettings.securityAlerts}
                      onCheckedChange={(checked: boolean) => 
                        setNotificationSettings(prev => ({ ...prev, securityAlerts: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Button onClick={saveSystemConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : '設定を保存'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API設定
              </CardTitle>
              <CardDescription>APIキーとアクセス設定</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button>
                    <Key className="h-4 w-4 mr-2" />
                    新しいAPIキーを生成
                  </Button>
                </div>

                <div className="space-y-3">
                  {apiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{apiKey.name}</h4>
                            <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                              {apiKey.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {apiKey.key}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>作成日: {apiKey.created}</span>
                            <span>最終使用: {apiKey.lastUsed}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">無効化</Button>
                          <Button variant="destructive" size="sm">削除</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                メンテナンスモード
              </CardTitle>
              <CardDescription>システムメンテナンスの設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="space-y-0.5">
                  <Label className="text-base">メンテナンスモード</Label>
                  <p className="text-sm text-muted-foreground">
                    有効にすると、管理者以外のユーザーはアクセスできなくなります
                  </p>
                </div>
                <Switch 
                  checked={systemConfig.maintenanceMode}
                  onCheckedChange={(checked: boolean) => 
                    setSystemConfig(prev => ({ ...prev, maintenanceMode: checked }))
                  }
                />
              </div>

              {systemConfig.maintenanceMode && (
                <div className="space-y-2">
                  <Label>メンテナンスメッセージ</Label>
                  <Textarea 
                    value={systemConfig.maintenanceMessage}
                    onChange={(e) => 
                      setSystemConfig(prev => ({ ...prev, maintenanceMessage: e.target.value }))
                    }
                    rows={4}
                    placeholder="メンテナンス中に表示するメッセージ"
                  />
                </div>
              )}

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-medium">デバッグ設定</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>デバッグモード</Label>
                    <p className="text-sm text-muted-foreground">
                      詳細なエラー情報とログを出力
                    </p>
                  </div>
                  <Switch 
                    checked={systemConfig.debugMode}
                    onCheckedChange={(checked: boolean) => 
                      setSystemConfig(prev => ({ ...prev, debugMode: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-medium">データベースメンテナンス</h3>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    バックアップ実行
                  </Button>
                  <Button variant="outline">
                    <Zap className="h-4 w-4 mr-2" />
                    最適化実行
                  </Button>
                </div>
              </div>

              <Button onClick={saveSystemConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : '設定を保存'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}