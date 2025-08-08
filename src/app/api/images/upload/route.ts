import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Simple image upload API to Supabase Storage with signed URL response
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 })
    }

    // Basic validation
    const contentType = file.type
    const size = file.size
    const accept = ['image/jpeg', 'image/png', 'image/webp']
    if (!accept.includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Path: org/{orgId}/{yyyy}/{mm}/{dd}/{timestamp}-{random}.ext
    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    const orgId = userRow?.organization_id ?? 'unknown'

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const ts = now.getTime()
    const rand = Math.random().toString(36).slice(2, 8)
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const path = `org/${orgId}/${yyyy}/${mm}/${dd}/${ts}-${rand}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    const { error: upErr } = await supabase.storage
      .from('uploads')
      .upload(path, uint8, { contentType, upsert: false })
    if (upErr) {
      console.error('Upload error:', upErr)
      return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
    }

    // Signed URL for short time (1 hour)
    const { data: signed, error: signErr } = await supabase.storage
      .from('uploads')
      .createSignedUrl(path, 60 * 60)
    if (signErr || !signed?.signedUrl) {
      console.error('Signed URL error:', signErr)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: signed.signedUrl })
  } catch (e) {
    console.error('Image upload API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


