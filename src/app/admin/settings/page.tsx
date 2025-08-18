'use client'

import { Upload, X, Save, Settings } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

// Constants
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ICON_LOGO_FILE_SIZE = 2 * 1024 * 1024 // 2MB

// Utility functions
const cleanupBlobUrl = (url: string | null) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

const isValidName = (name: string): boolean => {
  return name.trim().length > 0 && name.trim().length <= 100
}

interface OrganizationSettings {
  name: string
  icon_url: string | null
  logo_url: string | null
  max_checks: number | null
  plan: string | null
}

export default function OrganizationSettingsPage() {
  const { organization, userProfile, loading: authLoading, refresh } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<OrganizationSettings>({
    name: '',
    icon_url: null,
    logo_url: null,
    max_checks: null,
    plan: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (organization) {
      setSettings({
        name: organization.name,
        icon_url: organization.icon_url,
        logo_url: organization.logo_url,
        max_checks: organization.max_checks,
        plan: organization.plan
      })
      setIconPreview(organization.icon_url)
      setLogoPreview(organization.logo_url)
    }
    setLoading(false)
  }, [organization])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrl(iconPreview)
      cleanupBlobUrl(logoPreview)
    }
  }, [iconPreview, logoPreview])

  const handleFileSelect = (type: 'icon' | 'logo', file: File | null) => {
    if (!file) return

    // Validate file type
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: 'エラー',
        description: 'JPEG、PNG、WebP形式のファイルのみ対応しています。',
        variant: 'destructive'
      })
      return
    }

    // Validate file size
    if (file.size > MAX_ICON_LOGO_FILE_SIZE) {
      toast({
        title: 'エラー',
        description: 'ファイルサイズは2MB以下にしてください。',
        variant: 'destructive'
      })
      return
    }

    if (type === 'icon') {
      // Clean up previous preview URL
      cleanupBlobUrl(iconPreview)
      setIconFile(file)
      setIconPreview(URL.createObjectURL(file))
    } else {
      // Clean up previous preview URL
      cleanupBlobUrl(logoPreview)
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const removeImage = (type: 'icon' | 'logo') => {
    if (type === 'icon') {
      // Clean up preview URL if it's a blob URL
      cleanupBlobUrl(iconPreview)
      setIconFile(null)
      setIconPreview(null)
      setSettings(prev => ({ ...prev, icon_url: null }))
    } else {
      // Clean up preview URL if it's a blob URL
      cleanupBlobUrl(logoPreview)
      setLogoFile(null)
      setLogoPreview(null)
      setSettings(prev => ({ ...prev, logo_url: null }))
    }
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      return data.signedUrl
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  const handleSave = async () => {
    if (!organization || !userProfile || userProfile.role !== 'admin') {
      toast({
        title: 'エラー',
        description: '管理者権限が必要です。',
        variant: 'destructive'
      })
      return
    }

    // Validate name
    if (!isValidName(settings.name)) {
      toast({
        title: 'エラー',
        description: '組織名は1文字以上100文字以下で入力してください。',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)

    try {
      let iconUrl = settings.icon_url
      let logoUrl = settings.logo_url

      // Upload new icon if selected
      if (iconFile) {
        const uploadedIconUrl = await uploadFile(iconFile)
        if (uploadedIconUrl) {
          iconUrl = uploadedIconUrl
        } else {
          throw new Error('アイコンのアップロードに失敗しました')
        }
      }

      // Upload new logo if selected
      if (logoFile) {
        const uploadedLogoUrl = await uploadFile(logoFile)
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl
        } else {
          throw new Error('ロゴのアップロードに失敗しました')
        }
      }

      // Save organization settings
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: settings.name,
          icon_url: iconUrl,
          logo_url: logoUrl
        })
      })

      if (!response.ok) {
        throw new Error('設定の保存に失敗しました')
      }

      // Update preview URLs to reflect uploaded images before clearing files
      if (iconUrl && iconFile) {
        // Clean up the previous blob URL first
        cleanupBlobUrl(iconPreview)
        setIconPreview(iconUrl)
      }
      if (logoUrl && logoFile) {
        // Clean up the previous blob URL first
        cleanupBlobUrl(logoPreview)
        setLogoPreview(logoUrl)
      }
      
      // Clear file selections
      setIconFile(null)
      setLogoFile(null)
      
      // Update settings state with new values
      setSettings(prev => ({
        ...prev,
        icon_url: iconUrl,
        logo_url: logoUrl
      }))

      // Refresh auth context to get updated organization data
      await refresh()

      toast({
        title: '成功',
        description: '組織設定を保存しました。',
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '設定の保存に失敗しました。',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) {
    return <div className="p-6">読み込み中...</div>
  }

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">アクセスが拒否されました</h1>
          <p>このページにアクセスするには管理者権限が必要です。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">組織設定</h1>
          <p className="text-muted-foreground">組織の基本情報とブランディング設定</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 基本設定 */}
        <Card>
          <CardHeader>
            <CardTitle>基本設定</CardTitle>
            <CardDescription>組織の基本情報を設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="organization-name">組織名</Label>
              <Input
                id="organization-name"
                value={settings.name}
                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                placeholder="組織名を入力"
              />
            </div>
            <div>
              <Label>プラン</Label>
              <div className="text-sm text-muted-foreground">
                {settings.plan === 'trial' ? 'トライアル' : settings.plan === 'basic' ? 'ベーシック' : '未設定'}
              </div>
            </div>
            <div>
              <Label>月間チェック上限</Label>
              <div className="text-sm text-muted-foreground">
                {settings.max_checks ? `${settings.max_checks.toLocaleString()}回` : '無制限'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* アイコン設定 */}
        <Card>
          <CardHeader>
            <CardTitle>組織アイコン</CardTitle>
            <CardDescription>ナビゲーションなどで表示される小さいアイコン（推奨: 64x64px）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              {iconPreview ? (
                <div className="relative">
                  <Image
                    src={iconPreview}
                    alt="組織アイコン"
                    width={64}
                    height={64}
                    className="rounded-lg border-2 border-gray-200"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 w-6 h-6 p-0"
                    onClick={() => removeImage('icon')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <Label htmlFor="icon-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      アイコンを選択
                    </span>
                  </Button>
                </Label>
                <Input
                  id="icon-upload"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFileSelect('icon', e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ロゴ設定 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>組織ロゴ</CardTitle>
            <CardDescription>ヘッダーやレポートで表示される大きなロゴ（推奨: 横幅200-400px）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4">
              {logoPreview ? (
                <div className="relative">
                  <Image
                    src={logoPreview}
                    alt="組織ロゴ"
                    width={200}
                    height={100}
                    className="rounded-lg border-2 border-gray-200 object-contain"
                    style={{ maxHeight: '100px' }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 w-6 h-6 p-0"
                    onClick={() => removeImage('logo')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      ロゴを選択
                    </span>
                  </Button>
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFileSelect('logo', e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '設定を保存'}
        </Button>
      </div>
    </div>
  )
}