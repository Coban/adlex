/**
 * 画像前処理機能
 * OCR精度向上のための画像最適化とフォーマット変換
 */

export interface ImageProcessingOptions {
  /** 最大幅（ピクセル） */
  maxWidth?: number
  /** 最大高さ（ピクセル） */
  maxHeight?: number
  /** JPEG品質 (0-100) */
  jpegQuality?: number
  /** 対象フォーマット */
  targetFormat?: 'jpeg' | 'png'
  /** 最大ファイルサイズ（バイト） */
  maxFileSizeBytes?: number
}

export interface ImageProcessingResult {
  /** 処理済み画像バッファ */
  processedBuffer: Buffer
  /** 処理前のメタデータ */
  originalMetadata: {
    width?: number
    height?: number
    format?: string
    sizeBytes: number
  }
  /** 処理後のメタデータ */
  processedMetadata: {
    width?: number
    height?: number
    format: string
    sizeBytes: number
  }
  /** 適用された処理 */
  appliedProcessing: string[]
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  maxWidth: 2048,
  maxHeight: 2048,
  jpegQuality: 85,
  targetFormat: 'jpeg',
  maxFileSizeBytes: 4 * 1024 * 1024 // 4MB
}

/**
 * 画像を前処理する（ブラウザ環境用）
 */
export async function preprocessImageBrowser(
  imageFile: File | Blob,
  options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const appliedProcessing: string[] = []

  // 元画像の情報を取得
  const originalSizeBytes = imageFile.size
  const originalMetadata = {
    sizeBytes: originalSizeBytes,
    format: imageFile.type || 'unknown'
  }

  // Canvas で画像を処理
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = () => {
      const originalWidth = img.width
      const originalHeight = img.height

      // リサイズが必要かチェック
      const { width: newWidth, height: newHeight } = calculateNewDimensions(
        originalWidth,
        originalHeight,
        opts.maxWidth,
        opts.maxHeight
      )

      if (newWidth !== originalWidth || newHeight !== originalHeight) {
        appliedProcessing.push(`resize:${originalWidth}x${originalHeight}→${newWidth}x${newHeight}`)
      }

      // Canvasのサイズを設定
      canvas.width = newWidth
      canvas.height = newHeight

      // 画像を描画
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      // フォーマット変換
      const mimeType = `image/${opts.targetFormat}`
      if (originalMetadata.format !== mimeType) {
        appliedProcessing.push(`format:${originalMetadata.format}→${mimeType}`)
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'))
            return
          }

          blob.arrayBuffer().then((arrayBuffer) => {
            const processedBuffer = Buffer.from(arrayBuffer)
            const processedSizeBytes = processedBuffer.length

            // ファイルサイズチェック
            if (processedSizeBytes > opts.maxFileSizeBytes) {
              appliedProcessing.push(`size-warning:${processedSizeBytes} > ${opts.maxFileSizeBytes}`)
            }

            resolve({
              processedBuffer,
              originalMetadata: {
                ...originalMetadata,
                width: originalWidth,
                height: originalHeight
              },
              processedMetadata: {
                width: newWidth,
                height: newHeight,
                format: mimeType,
                sizeBytes: processedSizeBytes
              },
              appliedProcessing
            })
          }).catch(reject)
        },
        mimeType,
        opts.targetFormat === 'jpeg' ? opts.jpegQuality / 100 : 1.0
      )
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = URL.createObjectURL(imageFile)
  })
}

/**
 * 画像を前処理する（Node.js環境用）
 * Sharp が利用できない場合の基本的な処理
 */
export async function preprocessImageNode(
  imageBuffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const appliedProcessing: string[] = []

  const originalSizeBytes = imageBuffer.length
  
  // 基本的な画像形式検出
  const format = detectImageFormat(imageBuffer)
  
  const originalMetadata = {
    sizeBytes: originalSizeBytes,
    format
  }

  // Node.js環境では基本的な前処理のみ
  // 実際のリサイズや変換にはsharpなどのライブラリが必要
  
  if (originalSizeBytes > opts.maxFileSizeBytes) {
    appliedProcessing.push(`size-warning:${originalSizeBytes} > ${opts.maxFileSizeBytes}`)
  }

  // 現状では入力をそのまま返す（必要に応じてsharpを追加）
  return {
    processedBuffer: imageBuffer,
    originalMetadata,
    processedMetadata: {
      format: format ?? 'unknown',
      sizeBytes: originalSizeBytes
    },
    appliedProcessing: appliedProcessing.length > 0 ? appliedProcessing : ['no-processing']
  }
}

/**
 * 新しい画像サイズを計算
 */
function calculateNewDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  const widthRatio = maxWidth / originalWidth
  const heightRatio = maxHeight / originalHeight
  const ratio = Math.min(widthRatio, heightRatio)

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  }
}

/**
 * 画像フォーマットを検出
 */
function detectImageFormat(buffer: Buffer): string | undefined {
  if (buffer.length < 4) return undefined

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png'
  }

  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'image/jpeg'
  }

  // WebP
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
    return 'image/webp'
  }

  // GIF
  if (buffer.slice(0, 3).toString() === 'GIF') {
    return 'image/gif'
  }

  return undefined
}

/**
 * 環境に応じた画像前処理を実行
 */
export async function preprocessImage(
  input: Buffer | File | Blob,
  options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
  if (typeof window !== 'undefined' && (input instanceof File || input instanceof Blob)) {
    // ブラウザ環境
    return preprocessImageBrowser(input, options)
  } else if (Buffer.isBuffer(input)) {
    // Node.js環境
    return preprocessImageNode(input, options)
  } else {
    throw new Error('Unsupported input type or environment')
  }
}