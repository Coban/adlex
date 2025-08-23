import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { CheckDetail } from '../types'

interface CheckMetadataProps {
  check: CheckDetail
}

export function CheckMetadata({ check }: CheckMetadataProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">作成日時:</span>
            <div>{format(new Date(check.createdAt), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}</div>
          </div>
          {check.completedAt && (
            <div>
              <span className="font-medium text-gray-700">完了日時:</span>
              <div>{format(new Date(check.completedAt), 'yyyy/MM/dd HH:mm:ss', { locale: ja })}</div>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">入力タイプ:</span>
            <div>{check.inputType === 'image' ? '画像' : 'テキスト'}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">違反数:</span>
            <div>{check.violations.length}件</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">文字数:</span>
            <div>
              {check.inputType === 'image' && check.extractedText 
                ? check.extractedText.length 
                : check.originalText.length
              }文字
            </div>
          </div>
          {check.inputType === 'image' && check.ocrStatus && (
            <div>
              <span className="font-medium text-gray-700">OCRステータス:</span>
              <div>{check.ocrStatus}</div>
            </div>
          )}
        </div>
        
        {/* 画像表示 */}
        {check.inputType === 'image' && check.imageUrl && (
          <div className="mt-4 pt-4 border-t">
            <span className="font-medium text-gray-700 block mb-2">アップロード画像:</span>
            <Image
              src={check.imageUrl}
              alt="チェック対象画像"
              width={400}
              height={300}
              className="rounded border object-contain bg-gray-50"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}