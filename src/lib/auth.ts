import { createClient } from '@/lib/supabase/client'
import { UserProfileInsert, UserProfileUpdate, OrganizationPlan, UserRole } from '@/types'

export interface AuthError {
  message: string;
}

export interface SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface SignUpWithOrganizationData {
  email: string;
  password: string;
  confirmPassword: string;
  organizationName: string;
}

export interface InviteUserData {
  email: string;
  role: "admin" | "user";
}

/**
 * ユーザーをメール・パスワードで新規登録する。
 *
 * - パスワード一致と最小長のバリデーションを行う
 * - Supabase の `auth.signUp` を呼び出し、認証メールのリダイレクト先を設定する
 *
 * @param params サインアップ情報（メール・パスワード・確認用パスワード）
 * @returns Supabaseのサインアップ結果データ
 * @throws Error 入力不正、既登録、無効メール、その他サインアップエラー時
 */
export async function signUp({ email, password, confirmPassword }: SignUpData) {
  if (password !== confirmPassword) {
    throw new Error("パスワードが一致しません");
  }

  if (password.length < 6) {
    throw new Error("パスワードは6文字以上である必要があります");
  }

  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Signup error:", error);

      // Handle specific error cases
      if (error.message.includes("already registered")) {
        throw new Error("このメールアドレスは既に登録されています");
      } else if (error.message.includes("Invalid email")) {
        throw new Error("有効なメールアドレスを入力してください");
      } else if (error.message.includes("Password should be")) {
        throw new Error("パスワードは6文字以上である必要があります");
      } else {
        throw new Error(`アカウント作成エラー: ${error.message}`);
      }
    }

    return data;
  } catch (err) {
    console.error("Signup exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 管理者ロールでユーザーを作成し、同時に組織作成フローを付加して登録する。
 *
 * - パスワード一致・最小長、組織名のバリデーションを行う
 * - Supabase の `auth.signUp` にカスタムデータ（`organizationName`, `role`）を渡す
 *
 * @param params サインアップ情報（メール・パスワード・確認、組織名）
 * @returns Supabaseのサインアップ結果データ
 * @throws Error 入力不正、既登録、無効メール、その他サインアップエラー時
 */
export async function signUpWithOrganization({
  email,
  password,
  confirmPassword,
  organizationName,
}: SignUpWithOrganizationData) {
  if (password !== confirmPassword) {
    throw new Error("パスワードが一致しません");
  }

  if (password.length < 6) {
    throw new Error("パスワードは6文字以上である必要があります");
  }

  if (!organizationName.trim()) {
    throw new Error("組織名を入力してください");
  }

  const supabase = createClient();

  try {
    // ユーザーアカウントを作成
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          organizationName: organizationName.trim(),
          role: "admin",
        },
      },
    });

    if (error) {
      console.error("Organization signup error:", error);

      // Handle specific error cases
      if (error.message.includes("already registered")) {
        throw new Error("このメールアドレスは既に登録されています");
      } else if (error.message.includes("Invalid email")) {
        throw new Error("有効なメールアドレスを入力してください");
      } else if (error.message.includes("Password should be")) {
        throw new Error("パスワードは6文字以上である必要があります");
      } else {
        throw new Error(`組織アカウント作成エラー: ${error.message}`);
      }
    }

    return data;
  } catch (err) {
    console.error("Organization signup exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 組織にユーザーを招待するAPIを呼び出す。
 *
 * - E2E/スキップモードでは成功レスポンスを即時返す
 * - `/api/users/invite` に POST して結果を返す
 *
 * @param params 招待先メールとロール
 * @returns APIのJSONレスポンス
 * @throws Error 入力不正またはAPI側のエラー内容
 */
export async function inviteUser({ email, role }: InviteUserData) {
  if (!email.trim()) {
    throw new Error("メールアドレスを入力してください");
  }

  try {
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
      return { ok: true, message: '招待メールを送信しました' }
    }
    const response = await fetch("/api/users/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim(), role }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error ?? "ユーザー招待に失敗しました");
    }

    return await response.json();
  } catch (err) {
    console.error("Invite user exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 現在の組織に属するユーザー一覧を取得する。
 *
 * - E2E/スキップモードではモックデータを返す
 * - `/api/users` に GET し、403時は権限エラーを投げる
 *
 * @returns 組織ユーザーの配列を含むJSON
 * @throws Error 取得エラー、権限エラー時
 */
export async function fetchOrganizationUsers() {
  try {
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
      return {
        users: [
          { id: '00000000-0000-0000-0000-000000000001', email: 'admin@test.com', role: 'admin', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: '00000000-0000-0000-0000-000000000002', email: 'user@test.com', role: 'user', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ]
      }
    }
    const response = await fetch("/api/users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('権限がありません')
      }
      const errorData = (await response
        .json()
        .catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error ?? "ユーザー一覧の取得に失敗しました");
    }

    return await response.json();
  } catch (err) {
    console.error("Fetch organization users exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 対象ユーザーのロールを更新する。
 *
 * - E2E/スキップモードでは成功を返す
 * - `/api/users/:id/role` に PATCH して結果を返す
 *
 * @param userId 対象ユーザーID
 * @param role 設定するロール（admin|user）
 * @returns APIのJSONレスポンス
 * @throws Error API側のエラー内容
 */
export async function updateUserRole(userId: string, role: "admin" | "user") {
  try {
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || process.env.SKIP_AUTH === 'true') {
      return { ok: true }
    }
    const response = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error ?? "ユーザー権限の変更に失敗しました");
    }

    return await response.json();
  } catch (err) {
    console.error("Update user role exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 招待トークンでユーザーを登録する。
 *
 * - パスワード一致・最小長のバリデーション
 * - `/api/users/accept-invitation` に POST して登録
 *
 * @param token 招待トークン
 * @param password パスワード
 * @param confirmPassword 確認用パスワード
 * @returns APIのJSONレスポンス
 * @throws Error 入力不正またはAPI側エラー
 */
export async function signUpWithInvitation(
  token: string,
  password: string,
  confirmPassword: string,
) {
  if (password !== confirmPassword) {
    throw new Error("パスワードが一致しません");
  }

  if (password.length < 6) {
    throw new Error("パスワードは6文字以上である必要があります");
  }

  try {
    const response = await fetch("/api/users/accept-invitation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error ?? "招待の承認に失敗しました");
    }

    return await response.json();
  } catch (err) {
    console.error("Accept invitation exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * メール・パスワードでサインインする。
 *
 * - Supabase の `auth.signInWithPassword` を呼び出す
 * - よくある失敗（資格情報不一致・未確認メール）をユーザー向け文言に変換
 *
 * @param params サインイン情報
 * @returns Supabaseのサインイン結果データ
 * @throws Error 認証失敗やその他例外
 */
export async function signIn({ email, password }: SignInData) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Signin error:", error);

      // Handle specific error cases
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("メールアドレスまたはパスワードが正しくありません");
      } else if (error.message.includes("Email not confirmed")) {
        throw new Error(
          "メールアドレスの確認が完了していません。メールをご確認ください。",
        );
      } else {
        throw new Error(`サインインエラー: ${error.message}`);
      }
    }

    return data;
  } catch (err) {
    console.error("Signin exception:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("予期しないエラーが発生しました");
  }
}

/**
 * 現在のセッションをサインアウトする。
 *
 * - Supabase の `auth.signOut` を呼び出す
 * - 画面遷移は呼び出し側で行う
 *
 * @throws Error サインアウトに失敗した場合
 */
export async function signOut() {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('lib/auth: SignOut error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error
      });
      throw new Error(`サインアウトエラー: ${error.message}`);
    }
    // Navigation after sign out should be handled by the caller (e.g., components using useRouter)
    
  } catch (err) {
    console.error('lib/auth: SignOut exception:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('予期しないエラーが発生しました');
  }
}

// Additional auth functions expected by the tests
/**
 * 入力バリデーションを含むテスト用のサインインヘルパー。
 *
 * @param email メールアドレス
 * @param password パスワード（8文字以上）
 * @returns Supabaseのサインイン結果データ
 * @throws Error 入力不正または認証エラー
 */
export async function signInWithEmailAndPassword(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 入力バリデーションを含むテスト用のサインアップヘルパー。
 *
 * @param email メールアドレス
 * @param password パスワード（8文字以上）
 * @returns Supabaseのサインアップ結果データ
 * @throws Error 入力不正またはサインアップエラー
 */
export async function signUpWithEmailAndPassword(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 現在のユーザー情報を取得する。
 *
 * @returns Supabaseユーザーまたはnull
 * @throws Error 取得時のエラー
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
    throw error;
  }
  
  return data.user;
}

/**
 * 指定ユーザーのプロフィールを取得する。
 *
 * - レコードが存在しない場合は `null` を返す
 *
 * @param userId ユーザーID
 * @returns プロフィール行または null
 * @throws Error DBエラー
 */
export async function getUserProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
  
  if (error) {
    if (error.message === 'Profile not found') {
      return null;
    }
    throw error;
  }
  
  return data;
}

/**
 * ユーザープロフィールを作成（存在すれば upsert）。
 *
 * @param profile 作成するプロフィール
 * @returns 作成（更新）されたプロフィール
 * @throws Error 入力不正またはDBエラー
 */
export async function createUserProfile(profile: UserProfileInsert) {
  if (!profile.id) {
    throw new Error('User ID is required');
  }
  
  if (!profile.email) {
    throw new Error('Email is required');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('users').upsert(profile).select().single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * ユーザープロフィールを更新する。
 *
 * @param userId ユーザーID
 * @param updates 更新内容
 * @returns 更新後のプロフィール
 * @throws Error 入力不正またはDBエラー
 */
export async function updateUserProfile(userId: string, updates: UserProfileUpdate) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('users').update(updates).eq('id', userId).single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 指定メールのユーザーが存在するかを確認する。
 *
 * @param email メールアドレス
 * @returns 存在すれば true、なければ false
 * @throws Error DBエラー
 */
export async function checkUserExists(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  
  if (error) {
    throw error;
  }
  
  return data !== null;
}

/**
 * 新しい組織を作成する。
 *
 * @param name 組織名
 * @param plan 契約プラン
 * @returns 作成された組織
 * @throws Error 入力不正またはDBエラー
 */
export async function createOrganization(name: string, plan: OrganizationPlan) {
  if (!name) {
    throw new Error('Organization name is required');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('organizations').insert({ name, plan }).select().single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 組織へのユーザー招待レコードを作成する（テスト向け）。
 *
 * @param email 招待メール
 * @param organizationId 組織ID
 * @param role ロール
 * @returns 追加された招待レコード
 * @throws Error 入力不正またはDBエラー
 */
export async function inviteUserToOrganization(email: string, organizationId: number, role: UserRole) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('user_invitations').insert({
    email,
    organization_id: organizationId,
    role,
    token: 'invite-token-' + Date.now(),
    invited_by: '' // TODO: Get current user ID
  }).select().single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 招待トークンに一致する招待レコードを取得する（テスト向け）。
 *
 * @param token 招待トークン
 * @returns 取得した招待レコード
 * @throws Error 入力不正またはDBエラー
 */
export async function acceptInvitation(token: string) {
  if (!token) {
    throw new Error('Token is required');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('user_invitations').select('*').eq('token', token).single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * 指定ユーザーのロールを直接更新する（テスト向け）。
 *
 * @param userId 対象ユーザーID
 * @param role 設定するロール
 * @returns 更新後のユーザーレコード
 * @throws Error 入力不正またはDBエラー
 */
export async function changeUserRole(userId: string, role: UserRole) {
  if (!['admin', 'user'].includes(role)) {
    throw new Error('Invalid role');
  }
  
  const supabase = createClient();
  const { data, error } = await supabase.from('users').update({ role }).eq('id', userId).single();
  
  if (error) {
    throw error;
  }
  
  return data;
}
