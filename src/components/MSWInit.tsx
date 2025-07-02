'use client';

import { useEffect } from 'react';

// E2Eテスト時にMSWを初期化するコンポーネント
export default function MSWInit() {
  useEffect(() => {
    // E2Eテスト環境の場合のみMSWを起動
    if (
      process.env.NODE_ENV === 'development' && 
      (process.env.NEXT_PUBLIC_MSW_ENABLED === 'true' || 
       typeof window !== 'undefined' && window.location.search.includes('msw=true'))
    ) {
      // 動的インポートでブラウザー環境でのみMSWを読み込み
      import('../test/mocks/browser').then(({ worker }) => {
        worker.start({
          onUnhandledRequest: 'bypass',
        });
        console.log('MSW: モックワーカーが開始されました');
      }).catch((error) => {
        console.warn('MSW: モックワーカーの開始に失敗しました', error);
      });
    }
  }, []);

  return null;
} 