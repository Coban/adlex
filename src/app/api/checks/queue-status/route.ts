import { NextResponse } from 'next/server'

import { queueManager } from '@/lib/queue-manager'

export async function GET() {
  try {
    const status = queueManager.getStatus()
    
    return NextResponse.json({
      success: true,
      queue: status
    })
  } catch (error) {
    console.error('Error getting queue status:', error)
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    )
  }
} 