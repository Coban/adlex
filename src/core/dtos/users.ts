import { z } from 'zod'

/**
 * ユーザー一覧取得のクエリパラメータスキーマ
 */
export const GetUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['admin', 'user', 'ALL']).optional().default('ALL'),
  organizationId: z.coerce.number().optional()
})

/**
 * ユーザー招待APIのリクエストスキーマ
 */
export const InviteUserRequestSchema = z.object({
  email: z.string()
    .email('有効なメールアドレスを入力してください'),
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: 'ロールは "admin" または "user" である必要があります' })
  })
})

/**
 * ユーザー役割更新のパスパラメータスキーマ
 */
export const UpdateUserRoleParamsSchema = z.object({
  id: z.string().uuid('有効なユーザーIDである必要があります')
})

/**
 * ユーザー役割更新APIのリクエストスキーマ
 */
export const UpdateUserRoleRequestSchema = z.object({
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: '役割は "admin" または "user" である必要があります' })
  })
})

/**
 * ユーザー役割更新のレスポンススキーマ
 */
export const UpdateUserRoleResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(['admin', 'user']),
    updated_at: z.string().nullable()
  }),
  message: z.string()
})

/**
 * 招待受諾APIのリクエストスキーマ
 */
export const AcceptInvitationRequestSchema = z.object({
  token: z.string().min(1, 'トークンが必要です'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります')
})

/**
 * ユーザー招待APIのレスポンススキーマ
 */
export const InviteUserResponseSchema = z.object({
  invitationId: z.number(),
  email: z.string(),
  role: z.string(),
  message: z.string()
})

/**
 * 招待受諾のレスポンススキーマ
 */
export const AcceptInvitationResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  message: z.string()
})

/**
 * ユーザー一覧取得のレスポンススキーマ
 */
export const GetUsersResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
    role: z.enum(['admin', 'user']),
    organizationId: z.number(),
    createdAt: z.string(),
    updatedAt: z.string()
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  })
})

// TypeScript型定義
export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>
export type InviteUserRequest = z.infer<typeof InviteUserRequestSchema>
export type UpdateUserRoleParams = z.infer<typeof UpdateUserRoleParamsSchema>
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>
export type UpdateUserRoleResponse = z.infer<typeof UpdateUserRoleResponseSchema>
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>
export type InviteUserResponse = z.infer<typeof InviteUserResponseSchema>
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>
export type GetUsersResponse = z.infer<typeof GetUsersResponseSchema>

/**
 * バリデーション結果型
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * バリデーション関数
 */
export function validateGetUsersQuery(data: unknown): ValidationResult<GetUsersQuery> {
  try {
    const result = GetUsersQuerySchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

export function validateInviteUserRequest(data: unknown): ValidationResult<InviteUserRequest> {
  try {
    const result = InviteUserRequestSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

export function validateUpdateUserRoleParams(data: unknown): ValidationResult<UpdateUserRoleParams> {
  try {
    const result = UpdateUserRoleParamsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

export function validateUpdateUserRoleRequest(data: unknown): ValidationResult<UpdateUserRoleRequest> {
  try {
    const result = UpdateUserRoleRequestSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

export function validateAcceptInvitationRequest(data: unknown): ValidationResult<AcceptInvitationRequest> {
  try {
    const result = AcceptInvitationRequestSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors.map(e => e.message).join(', '),
          details: error.errors
        }
      }
    }
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'バリデーションエラーが発生しました'
      }
    }
  }
}

/**
 * レスポンスヘルパー関数
 */
export function createSuccessResponse<T>(data: T): T {
  return data
}

export function createErrorResponse(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      details
    }
  }
}