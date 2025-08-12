import { NextRequest, NextResponse } from 'next/server'

import { queueManager } from '@/lib/queue-manager'
import { createClient } from '@/lib/supabase/server'

/**
 * 薬機法チェック処理を開始するAPIエンドポイント
 * テキストまたは画像の入力を受け取り、非同期でチェック処理をキューに追加する
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // ユーザーセッションの取得 - Cookieとヘッダーの両方で認証を試行
    let user, authError
    
    // まずCookieからユーザーを取得（SSRアプローチ）
    const authResult = await supabase.auth.getUser()
    user = authResult.data.user
    authError = authResult.error
    
    // Cookieでユーザーが見つからない場合、Authorizationヘッダーを確認
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        
        try {
          // サービスロールクライアントを使用してトークンを検証
          const { createClient: createServiceClient } = await import('@supabase/supabase-js')
          const supabaseService = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          
          const { data: { user: tokenUser }, error: tokenError } = await supabaseService.auth.getUser(token)
          
          if (tokenUser && !tokenError) {
            user = tokenUser
            authError = null
          } else {
            authError = tokenError ?? new Error('Invalid token')
          }
        } catch {
          authError = new Error('Token validation failed')
        }
      }
    }

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 組織情報を含むユーザーデータを取得
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        role,
        organization_id,
        organizations!inner (
          id,
          name,
          max_checks,
          used_checks
        )
      `)
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      console.error('User lookup failed:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 使用量制限のチェック
    const organization = userData.organizations
    const currentUsage = organization.used_checks ?? 0
    const maxChecks = organization.max_checks ?? 1000
    if (currentUsage >= maxChecks) {
      return NextResponse.json({ 
        error: 'Monthly usage limit exceeded',
        usage: currentUsage,
        limit: maxChecks
      }, { status: 429 })
    }

    const body = await request.json()
    const { text, input_type = 'text', image_url } = body

    // 入力タイプ別のバリデーション
    if (input_type === 'image') {
      if (!image_url || typeof image_url !== 'string') {
        return NextResponse.json({ error: 'image_url is required for image checks' }, { status: 400 })
      }
    } else {
      if (!text || typeof text !== 'string') {
        return NextResponse.json({ error: 'Text is required' }, { status: 400 })
      }
    }

    // テキスト長のバリデーション（テキストモードのみ）
    if (input_type !== 'image' && text.length > 10000) {
      return NextResponse.json({ error: 'Text too long (max 10000 characters)' }, { status: 400 })
    }

    // テキストのクリーンアップとバリデーション
    const cleanText = input_type === 'image' ? '' : String(text).trim()
    if (input_type !== 'image' && !cleanText) {
      return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 })
    }

    // チェックレコードの作成
    const { data: checkData, error: checkError } = await supabase
      .from('checks')
      .insert({
        user_id: user.id,
        organization_id: userData.organization_id!,
        input_type: input_type,
        original_text: input_type === 'image' ? '' : cleanText,
        image_url: image_url,
        ocr_status: input_type === 'image' ? 'pending' : null,
        status: 'pending'
      })
      .select()
      .single()

    if (checkError) {
      console.error('Error creating check:', checkError)
      return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
    }

    // 処理キューに追加
    await queueManager.addToQueue(
      checkData.id, 
      cleanText, 
      userData.organization_id!,
      'normal',
      input_type,
      image_url
    )

    return NextResponse.json({
      id: checkData.id,
      status: 'pending'
    })

  } catch (error) {
    console.error('Error in checks API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}