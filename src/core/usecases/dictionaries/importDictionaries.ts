import { AuthenticationError, AuthorizationError } from '@/core/domain/errors'
import { RepositoryContainer } from '@/core/ports'

interface ParsedDictionaryRow {
  phrase: string
  category: 'NG' | 'ALLOW'
  notes: string | null
}

interface CsvParseResult {
  rows: ParsedDictionaryRow[]
  errors: string[]
}

interface SkippedItem {
  phrase: string
  reason: string
}

/**
 * 辞書インポートのユースケース入力
 */
export interface ImportDictionariesInput {
  currentUserId: string
  csvContent: string
  contentType: string
}

/**
 * 辞書インポートのユースケース出力
 */
export interface ImportDictionariesOutput {
  inserted: number
  skipped: number
  message: string
  errors?: string[]
  details?: {
    skippedItems: SkippedItem[]
  }
}

/**
 * 辞書インポートのユースケース結果
 */
export type ImportDictionariesResult = 
  | { success: true; data: ImportDictionariesOutput }
  | { success: false; error: { code: string; message: string; details?: unknown } }

/**
 * 辞書インポートユースケース
 */
export class ImportDictionariesUseCase {
  constructor(private repositories: RepositoryContainer) {}

  async execute(input: ImportDictionariesInput): Promise<ImportDictionariesResult> {
    try {
      // 入力バリデーション
      const validationError = this.validateInput(input)
      if (validationError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: validationError }
        }
      }

      // 現在のユーザーを取得
      const currentUser = await this.repositories.users.findById(input.currentUserId)
      if (!currentUser) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが見つかりません' }
        }
      }

      if (!currentUser.organization_id) {
        return {
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'ユーザーが組織に所属していません' }
        }
      }

      // 管理者権限チェック
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: '管理者権限が必要です' }
        }
      }

      // CSV解析
      const { rows, errors } = this.parseCsv(input.csvContent)
      if (rows.length === 0) {
        return {
          success: false,
          error: { 
            code: 'VALIDATION_ERROR', 
            message: '有効な行がありません',
            details: errors
          }
        }
      }

      // 既存辞書の取得（重複チェック用）
      const existingDictionaries = await this.repositories.dictionaries.findByOrganizationId(
        currentUser.organization_id
      )
      const existingPhrases = new Set(existingDictionaries.map(d => d.phrase.trim()))

      // インポート処理
      const skippedItems: SkippedItem[] = []
      const validInserts: Array<{
        organization_id: number
        phrase: string
        category: 'NG' | 'ALLOW'
        notes: string | null
      }> = []

      for (const row of rows) {
        if (existingPhrases.has(row.phrase)) {
          skippedItems.push({ 
            phrase: row.phrase, 
            reason: '既に存在するためスキップ' 
          })
          continue
        }

        validInserts.push({
          organization_id: currentUser.organization_id,
          phrase: row.phrase,
          category: row.category,
          notes: row.notes
        })
      }

      // チャンク分割してDB挿入
      const chunkSize = 500
      let totalInserted = 0

      for (let i = 0; i < validInserts.length; i += chunkSize) {
        const chunk = validInserts.slice(i, i + chunkSize)
        if (chunk.length === 0) continue

        try {
          const insertedItems = await this.repositories.dictionaries.bulkCreate(chunk)
          totalInserted += insertedItems.length

          // 埋め込みベクトル生成（非同期でバックグラウンド処理）
          const itemsWithOrgId = insertedItems
            .filter(item => item.organization_id !== null)
            .map(item => ({
              id: item.id,
              phrase: item.phrase,
              organization_id: String(item.organization_id!),
              category: chunk.find(c => c.phrase === item.phrase)?.category ?? 'NG' as 'NG' | 'ALLOW'
            }))
          this.generateEmbeddingsInBackground(itemsWithOrgId)
        } catch (error) {
          console.error(`Chunk insert error (${i}-${i + chunk.length}):`, error)
          // 部分的な失敗でも継続
        }
      }

      return {
        success: true,
        data: {
          inserted: totalInserted,
          skipped: skippedItems.length,
          message: `${totalInserted}件のインポートが完了し、${skippedItems.length}件がスキップされました`,
          errors: errors.length > 0 ? errors : undefined,
          details: skippedItems.length > 0 ? { skippedItems } : undefined
        }
      }

    } catch (error) {
      console.error('Import dictionaries usecase error:', error)
      
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return {
          success: false,
          error: { code: error.code, message: error.message }
        }
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' }
      }
    }
  }

  /**
   * 入力値のバリデーション
   */
  private validateInput(input: ImportDictionariesInput): string | null {
    if (!input.currentUserId || typeof input.currentUserId !== 'string') {
      return 'ユーザーIDが無効です'
    }

    if (!input.csvContent || typeof input.csvContent !== 'string') {
      return 'CSV内容が必要です'
    }

    if (!input.contentType?.includes('text/csv')) {
      return 'Content-Typeはtext/csvである必要があります'
    }

    return null
  }

  /**
   * CSV文字列の解析
   */
  private parseCsv(text: string): CsvParseResult {
    const errors: string[] = []
    const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(l => l.trim().length > 0)
    
    if (lines.length === 0) {
      return { rows: [], errors: ["CSVが空です"] }
    }

    // ヘッダー解析
    const first = lines[0].replace(/^\ufeff/, "")
    const header = first.split(",").map(h => h.trim().toLowerCase())
    const idxPhrase = header.indexOf("phrase")
    const idxCategory = header.indexOf("category")
    const idxNotes = header.indexOf("notes")
    
    if (idxPhrase === -1 || idxCategory === -1) {
      errors.push("ヘッダにphrase,categoryが必要です")
      return { rows: [], errors }
    }

    const rows: ParsedDictionaryRow[] = []
    const seenInFile = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i]
      const cols = this.splitCsvLine(raw)

      const phrase = this.unescapeCsv(cols[idxPhrase] ?? "").trim()
      const categoryRaw = this.unescapeCsv(cols[idxCategory] ?? "").trim().toUpperCase() as "NG" | "ALLOW"
      const notesRaw = idxNotes >= 0 ? this.unescapeCsv(cols[idxNotes] ?? "").trim() : null
      const notes = notesRaw === "" ? null : notesRaw

      if (!phrase) {
        errors.push(`${i + 1}行目: phraseが空です`)
        continue
      }

      if (categoryRaw !== "NG" && categoryRaw !== "ALLOW") {
        errors.push(`${i + 1}行目: categoryはNG/ALLOWのみ有効です`)
        continue
      }

      if (seenInFile.has(phrase)) {
        errors.push(`${i + 1}行目: 同一ファイル内で重複するphraseのためスキップ (${phrase})`)
        continue
      }

      seenInFile.add(phrase)
      rows.push({ phrase, category: categoryRaw, notes })
    }

    return { rows, errors }
  }

  /**
   * CSV行の分割（ダブルクオート対応）
   */
  private splitCsvLine(line: string): string[] {
    const cols: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"'
            i++ // エスケープされたクオートをスキップ
          } else {
            inQuotes = false
          }
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          cols.push(current)
          current = ""
        } else {
          current += char
        }
      }
    }
    
    cols.push(current)
    return cols
  }

  /**
   * CSVフィールドのアンエスケープ
   */
  private unescapeCsv(field: string): string {
    const trimmed = field.trim()
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"')
    }
    return trimmed
  }

  /**
   * 埋め込みベクトル生成（バックグラウンド処理）
   */
  private generateEmbeddingsInBackground(items: Array<{ id: number; phrase: string; organization_id: string; category: 'NG' | 'ALLOW' }>): void {
    // 非同期でバックグラウンド処理
    Promise.resolve().then(async () => {
      for (const item of items) {
        try {
          // updateWithEmbeddingメソッドが内部で埋め込みを生成するため、
          // ここでは辞書項目の更新のみを行う
          await this.repositories.dictionaries.updateWithEmbedding(
            item.id, 
            Number(item.organization_id),
            {
              phrase: item.phrase,
              category: item.category,
              notes: null
            }
          )
        } catch (error) {
          console.error(`Embedding generation failed for item ${item.id}:`, error)
          // 埋め込み生成の失敗は全体の処理を止めない
        }
      }
    }).catch(error => {
      console.error('Background embedding generation error:', error)
    })
  }
}