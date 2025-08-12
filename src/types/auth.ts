import { Database } from './database.types'

// ユーザープロフィール作成時の型（INSERTクエリ用）
export type UserProfileInsert = Database['public']['Tables']['users']['Insert']

// ユーザープロフィール更新時の型（UPDATEクエリ用）
export type UserProfileUpdate = Database['public']['Tables']['users']['Update']

// 組織プラン（Free, Pro, Enterprise等）
export type OrganizationPlan = Database['public']['Enums']['organization_plan']

// ユーザー権限（admin, user等）
export type UserRole = Database['public']['Enums']['user_role']

// ユーザーテーブルのレコード型
export type UserProfile = Database['public']['Tables']['users']['Row']

// 組織テーブルのレコード型
export type Organization = Database['public']['Tables']['organizations']['Row']

// Supabase User型のダミー定義（実際はSupabaseから提供される）
export interface SupabaseUser extends Record<string, unknown> {
  id: string
  email?: string
}

// 認証コンテキストの型定義
export interface AuthContextType {
  user: SupabaseUser | null // Supabaseのユーザーオブジェクト
  userProfile: UserProfile | null // アプリケーションのユーザープロフィール
  organization: Organization | null // ユーザーが所属する組織
  loading: boolean // 認証状態のロード中フラグ
  signOut: () => Promise<void> // サインアウト関数
}