/**
 * AdLex統一ログシステム
 * 構造化されたログ出力とエラー追跡を提供
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
  userId?: string
  organizationId?: string
  operation?: string
  error?: Error | string
  stack?: string
  timestamp?: string
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const baseInfo = {
      timestamp,
      level,
      message,
      ...context
    }
    
    return JSON.stringify(baseInfo, null, 2)
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, context))
    
    // 本番環境では適切なログサービスに送信
    // 例: Sentry, Datadog, CloudWatch等
    if (process.env.NODE_ENV === 'production') {
      // this.sendToLogService(message, context)
    }
  }

  // エラーオブジェクト専用のログメソッド
  logError(error: Error, context?: Omit<LogContext, 'error' | 'stack'>) {
    this.error(`${error.name}: ${error.message}`, {
      ...context,
      error: error.message,
      stack: error.stack,
      errorName: error.name
    })
  }

  // 操作コンテキスト付きでエラーをログ
  logOperationError(operation: string, error: Error, context?: LogContext) {
    this.logError(error, {
      ...context,
      operation
    })
  }
}

export const logger = new Logger()