import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .order('id')

    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at')

    return NextResponse.json({
      organizations: {
        data: organizations,
        error: orgError,
        count: organizations?.length ?? 0
      },
      users: {
        data: users,
        error: usersError,
        count: users?.length ?? 0
      },
      summary: {
        usersWithoutOrg: users?.filter(u => !u.organization_id).length ?? 0,
        adminTestUser: users?.find(u => u.email === 'admin@test.com') ?? null
      }
    })
  } catch (error) {
    console.error('Database debug error:', error)
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
  }
}