import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
    
    console.log('API Test - Organizations:', testData, 'Error:', testError)
    
    // Test auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('API Test - Auth:', user?.id, 'Error:', authError)
    
    const result = {
      timestamp: new Date().toISOString(),
      organizations: { data: testData, error: testError },
      auth: { userId: user?.id, error: authError },
      user: null as { data: unknown; error: unknown } | null
    }
    
    if (user) {
      // Test user query
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      console.log('API Test - User:', userData, 'Error:', userError)
      result.user = { data: userData, error: userError }
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('API Test error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
