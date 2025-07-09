import { NextResponse } from 'next/server'

import { isUsingLMStudio } from '@/lib/ai-client'

export async function GET() {
  const config = {
    isUsingLMStudio: isUsingLMStudio(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      USE_LM_STUDIO: process.env.USE_LM_STUDIO,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET',
      LM_STUDIO_BASE_URL: process.env.LM_STUDIO_BASE_URL ?? 'default',
      LM_STUDIO_CHAT_MODEL: process.env.LM_STUDIO_CHAT_MODEL ?? 'default'
    }
  }

  return NextResponse.json(config)
}
