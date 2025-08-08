import { NextRequest, NextResponse } from 'next/server'

import { queueManager } from '@/lib/queue-manager'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user session - try both cookie and header authentication
    let user, authError
    
    // First try getting user from cookies (SSR approach)
    const authResult = await supabase.auth.getUser()
    user = authResult.data.user
    authError = authResult.error
    
    // If no user found from cookies, try Authorization header
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        
        try {
          // Use service role client to verify token
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
        } catch (tokenValidationError) {
          console.error('Token validation error:', tokenValidationError)
          authError = new Error('Token validation failed')
        }
      }
    }

    if (authError || !user) {
      console.log('Authentication failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data including organization
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

    // Check usage limits
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

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Validate text length
    if (text.length > 10000) {
      return NextResponse.json({ error: 'Text too long (max 10000 characters)' }, { status: 400 })
    }

    // Clean and validate text
    const cleanText = text.trim()
    if (!cleanText) {
      return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 })
    }

    // Create check record
    const { data: checkData, error: checkError } = await supabase
      .from('checks')
      .insert({
        user_id: user.id,
        organization_id: userData.organization_id!,
        input_type: input_type,
        original_text: cleanText,
        image_url: image_url,
        ocr_status: input_type === 'image' ? 'pending' : 'not_required',
        status: 'pending'
      })
      .select()
      .single()

    if (checkError) {
      console.error('Error creating check:', checkError)
      return NextResponse.json({ error: 'Failed to create check' }, { status: 500 })
    }

    // Add to queue for processing
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