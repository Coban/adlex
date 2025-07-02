'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SupabaseTest() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient()
        const { error } = await supabase.from('organizations').select('id').limit(1)
        
        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "table not found" which is expected for a test
          throw error
        }
        
        setStatus('connected')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus('error')
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-6 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Supabase Connection Status</h2>
      <div className="flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${
            status === 'loading' 
              ? 'bg-yellow-500' 
              : status === 'connected' 
              ? 'bg-green-500' 
              : 'bg-red-500'
          }`} 
        />
        <span>
          {status === 'loading' && 'Testing connection...'}
          {status === 'connected' && 'Connected to Supabase'}
          {status === 'error' && `Connection failed: ${error}`}
        </span>
      </div>
      {status === 'error' && (
        <p className="mt-2 text-sm text-gray-600">
          Make sure to set up your environment variables in .env.local
        </p>
      )}
    </div>
  )
}
