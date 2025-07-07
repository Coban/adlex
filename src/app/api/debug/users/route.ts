import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check public users
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('id, email, organization_id, role, created_at')
      .limit(10)

    // Check organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, plan, max_checks, used_checks')
      .limit(10)

    // Check specific user by email if admin@test.com exists
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@test.com')
      .maybeSingle()

    return NextResponse.json({
      currentAuthUser: {
        user,
        error: authError
      },
      publicUsers: {
        data: publicUsers, 
        error: publicError
      },
      organizations: {
        data: organizations,
        error: orgError
      },
      adminTestUser: {
        data: adminUser,
        error: adminError
      }
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 })
  }
}