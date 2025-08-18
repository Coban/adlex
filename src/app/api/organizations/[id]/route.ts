import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Validation helpers
const isValidName = (name: unknown): name is string => {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100
}

const isValidUrl = (url: unknown): url is string | null => {
  return url === null || typeof url === 'string'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const organizationId = parseInt(params.id)

    if (isNaN(organizationId)) {
      return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 })
    }

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if user belongs to the organization and is admin
    if (userProfile.organization_id !== organizationId || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, icon_url, logo_url } = body

    // Validate input using helper functions
    if (name !== undefined && !isValidName(name)) {
      return NextResponse.json({ 
        error: 'Name must be a non-empty string (1-100 characters)' 
      }, { status: 400 })
    }

    if (icon_url !== undefined && !isValidUrl(icon_url)) {
      return NextResponse.json({ 
        error: 'icon_url must be a string or null' 
      }, { status: 400 })
    }

    if (logo_url !== undefined && !isValidUrl(logo_url)) {
      return NextResponse.json({ 
        error: 'logo_url must be a string or null' 
      }, { status: 400 })
    }

    // Update organization
    const updateData: { 
      name?: string
      icon_url?: string | null
      logo_url?: string | null
      updated_at?: string
    } = {}
    if (name !== undefined) updateData.name = name.trim()
    if (icon_url !== undefined) updateData.icon_url = icon_url
    if (logo_url !== undefined) updateData.logo_url = logo_url
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single()

    if (error) {
      console.error('Organization update error:', error)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    return NextResponse.json({ organization: data })
  } catch (error) {
    console.error('Organizations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const organizationId = parseInt(params.id)

    if (isNaN(organizationId)) {
      return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 })
    }

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if user belongs to the organization
    if (userProfile.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (error) {
      console.error('Organization fetch error:', error)
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ organization: data })
  } catch (error) {
    console.error('Organizations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}