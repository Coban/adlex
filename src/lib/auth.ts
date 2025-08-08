import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'

type UserProfileInsert = Database['public']['Tables']['users']['Insert']
type UserProfileUpdate = Database['public']['Tables']['users']['Update']
type OrganizationPlan = Database['public']['Enums']['organization_plan']
type UserRole = Database['public']['Enums']['user_role']

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

export async function inviteUser({ email, role }: InviteUserData) {
  if (!email.trim()) {
    throw new Error("メールアドレスを入力してください");
  }

  try {
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

export async function fetchOrganizationUsers() {
  try {
    const response = await fetch("/api/users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
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

export async function updateUserRole(userId: string, role: "admin" | "user") {
  try {
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
    
    // Use Next.js router to navigate after sign out for better UX
    Router.replace('/');
    
  } catch (err) {
    console.error('lib/auth: SignOut exception:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('予期しないエラーが発生しました');
  }
}

// Additional auth functions expected by the tests
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

export async function getCurrentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
    throw error;
  }
  
  return data.user;
}

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

export async function checkUserExists(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  
  if (error) {
    throw error;
  }
  
  return data !== null;
}

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
