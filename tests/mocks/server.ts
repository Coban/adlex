import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// MSWサーバーのハンドラー設定
export const handlers = [
  // 画像アップロード API のモック
  http.post('/api/images/upload', () => {
    return HttpResponse.json({
      signedUrl: 'https://mock-storage-url.com/test-image.jpg'
    })
  }),

  // チェック作成 API のモック
  http.post('/api/checks', async ({ request }) => {
    const body = await request.json() as any
    
    if (body.input_type === 'image') {
      return HttpResponse.json({
        id: 123,
        checkId: 123
      })
    }
    
    return HttpResponse.json({
      id: 456,
      checkId: 456
    })
  }),

  // チェックストリーム API のモック
  http.get('/api/checks/:id/stream', () => {
    return new HttpResponse(
      `data: {"type":"queue_status","queue":{"queueLength":0,"processingCount":0,"maxConcurrent":3}}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }),

  // キューステータスストリーム API のモック
  http.get('/api/checks/stream', () => {
    return new HttpResponse(
      `data: {"type":"queue_status","queue":{"queueLength":0,"processingCount":0,"maxConcurrent":3,"availableSlots":3,"canStartNewCheck":true,"processingStats":{"text":0,"image":0}},"organization":{"monthlyLimit":100,"currentMonthChecks":5,"remainingChecks":95,"canPerformCheck":true},"system":{"timestamp":"${new Date().toISOString()}","serverLoad":{"queue":"idle","processing":"available"}}}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }),
]

// MSWサーバーの設定
export const server = setupServer(...handlers)