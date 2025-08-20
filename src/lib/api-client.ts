'use client'

import { useRouter } from 'next/navigation'

import { clearAuthData, createSignInUrl } from '@/lib/auth-redirect'

/**
 * API リクエストのインターセプターを提供するクラス
 * 401エラー時に自動的にサインインページにリダイレクトする
 */
export class ApiClient {
  private static instance: ApiClient
  private router?: ReturnType<typeof useRouter>

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  setRouter(router: ReturnType<typeof useRouter>) {
    this.router = router
  }

  /**
   * fetch のラッパー関数
   * 401エラー時に自動的にサインインページにリダイレクト
   */
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const response = await fetch(input, init)
      
      // 401エラーの場合、サインインページにリダイレクト
      if (response.status === 401) {
        this.handleUnauthorized()
        throw new Error('認証が必要です。サインインページに遷移します。')
      }
      
      return response
    } catch (error) {
      // ネットワークエラーなど、fetchレベルでのエラー
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Network error:', error)
      }
      throw error
    }
  }

  /**
   * 401エラー時の処理
   */
  private handleUnauthorized() {
    console.log('Session expired or unauthorized. Redirecting to sign in...')
    
    // 認証関連データをクリア
    clearAuthData()
    
    // サインインページにリダイレクト
    const signInUrl = createSignInUrl()
    
    if (this.router) {
      this.router.replace(signInUrl)
    } else {
      // routerが利用できない場合は直接リロード
      window.location.href = signInUrl
    }
  }
}

/**
 * グローバルに利用可能なAPI client インスタンス
 */
export const apiClient = ApiClient.getInstance()

/**
 * fetch のドロップイン置換
 * 401エラー時に自動リダイレクトする
 */
export const authFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return apiClient.fetch(input, init)
}