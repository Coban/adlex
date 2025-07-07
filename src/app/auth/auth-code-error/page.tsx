import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-red-600">認証エラー</CardTitle>
          <CardDescription className="text-center">
            認証コードの検証に失敗しました
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600">
            メールの認証リンクが無効または期限切れの可能性があります。
            再度サインアップを試すか、新しい認証メールをリクエストしてください。
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button asChild className="w-full">
            <Link href="/auth/signup">
              サインアップページに戻る
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/signin">
              サインインページに移動
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
