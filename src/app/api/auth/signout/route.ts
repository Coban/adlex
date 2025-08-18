import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import type { Database } from '@/types/database.types'

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Prepare a response object that Supabase client can write cookies into
  const supabaseResponse = NextResponse.json({ success: true })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await supabase.auth.signOut()
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: supabaseResponse.headers }
    )
  }

  return supabaseResponse
}


