'use client'

import { useState, useEffect } from 'react'

export default function SimpleTestPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    console.log('SimpleTestPage mounted')
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">簡単テストページ</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded bg-white">
          <h2 className="font-semibold mb-2 text-gray-900">基本テスト</h2>
          <div className="text-gray-900">このページは正常に表示されています</div>
          <div className="text-gray-900">現在時刻: {new Date().toLocaleString('ja-JP')}</div>
        </div>
      </div>
    </div>
  )
}
