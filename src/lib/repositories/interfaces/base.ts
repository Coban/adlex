/**
 * Base repository interface with common CRUD operations
 */
export interface BaseRepository<T, CreateT = Partial<T>, UpdateT = Partial<T>> {
  /**
   * Find a record by ID, returns null if not found
   */
  findById(id: number | string): Promise<T | null>

  /**
   * Find multiple records with optional filtering and pagination
   */
  findMany(options?: FindManyOptions<T>): Promise<T[]>

  /**
   * Create a new record
   */
  create(data: CreateT): Promise<T>

  /**
   * Update an existing record
   */
  update(id: number | string, data: UpdateT): Promise<T | null>

  /**
   * Delete a record by ID
   */
  delete(id: number | string): Promise<boolean>

  /**
   * Count records with optional filtering
   */
  count(filter?: Partial<T>): Promise<number>
}

/**
 * Options for finding multiple records
 */
export interface FindManyOptions<T> {
  where?: Partial<T>
  orderBy?: { field: keyof T; direction: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
  select?: (keyof T)[]
}

/**
 * Standard database response with count
 */
export interface CountResult {
  count: number
}

/**
 * Standard database error response
 */
export class RepositoryError extends Error {
  code?: string
  details?: string
  hint?: string

  constructor(message: string, code?: string, details?: string, hint?: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
    this.details = details
    this.hint = hint
  }
}