import { NextResponse } from 'next/server'

import { cache, CacheUtils } from '@/lib/cache'
import { queueManager } from '@/lib/queue-manager'
import { createClient } from '@/lib/supabase/server'

/**
 * キューの状態を取得するAPI
 * 複数チェック同時実行対応のためのキュー監視機能
 */
export async function GET() {
  try {
    // 認証チェック
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // キューマネージャーから現在の状態を取得
    const queueStatus = queueManager.getStatus()
    
    // データベースから処理中のチェック数を取得（より正確な情報）
    const { data: processingChecks, error: dbError } = await supabase
      .from('checks')
      .select('id, status, created_at, input_type')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
    
    if (dbError) {
      console.error('[QUEUE-STATUS] Database error:', dbError)
    }

    // ユーザー組織の情報を取得
    const { data: userProfile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    // 短寿命キャッシュ（2秒）
    const orgId = userProfile?.organization_id ?? 0
    const cacheKey = CacheUtils.queueStatusKey(orgId)
    const cached = cache.get<{ success: true; queue: Record<string, unknown>; organization: Record<string, unknown>; system: Record<string, unknown> }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // 組織の使用制限情報を取得
    const { data: organizationData } = await supabase
      .from('organizations')
      .select('max_checks, used_checks')
      .eq('id', userProfile?.organization_id ?? 0)
      .single()

    // 処理タイプ別の統計
    const processingStats = {
      text: processingChecks?.filter(c => c.input_type === 'text' || !c.input_type).length ?? 0,
      image: processingChecks?.filter(c => c.input_type === 'image').length ?? 0
    }

    const response = {
      success: true,
      queue: {
        queueLength: queueStatus.queueLength,
        processingCount: queueStatus.processingCount,
        maxConcurrent: queueStatus.maxConcurrent,
        databaseProcessingCount: processingChecks?.length ?? 0,
        availableSlots: Math.max(0, queueStatus.maxConcurrent - queueStatus.processingCount),
        processingStats,
        canStartNewCheck: queueStatus.processingCount < queueStatus.maxConcurrent
      },
      organization: {
        monthlyLimit: organizationData?.max_checks ?? 0,
        currentMonthChecks: organizationData?.used_checks ?? 0,
        remainingChecks: Math.max(0, (organizationData?.max_checks ?? 0) - (organizationData?.used_checks ?? 0)),
        canPerformCheck: (organizationData?.used_checks ?? 0) < (organizationData?.max_checks ?? 0)
      },
      system: {
        timestamp: new Date().toISOString(),
        serverLoad: {
          queue: queueStatus.queueLength > 0 ? 'busy' : 'idle',
          processing: queueStatus.processingCount === queueStatus.maxConcurrent ? 'full' : 'available'
        }
      }
    }

    cache.set(cacheKey, response, 2 * 1000)
    return NextResponse.json(response)
  } catch (error) {
    console.error('[QUEUE-STATUS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
} 