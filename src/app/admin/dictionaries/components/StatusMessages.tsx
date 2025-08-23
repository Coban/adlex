interface StatusMessagesProps {
  message: string
  isRegenerating: boolean
}

export function StatusMessages({ message, isRegenerating }: StatusMessagesProps) {
  return (
    <>
      {/* Success Message */}
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md" data-testid="success-message">
          <p className="text-green-800 text-sm">{message}</p>
        </div>
      )}

      {/* Processing Message */}
      {isRegenerating && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md" data-testid="processing-message">
          <p className="text-blue-800 text-sm">埋め込みを再生成中...</p>
        </div>
      )}
    </>
  )
}