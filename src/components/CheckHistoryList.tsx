'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface CheckHistory {
  id: number
  originalText: string
  modifiedText: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt: string | null
  userEmail?: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface HistoryResponse {
  checks: CheckHistory[]
  pagination: PaginationInfo
  userRole: 'admin' | 'user'
}

const statusLabels = {
  pending: { label: '待機中', className: 'bg-gray-100 text-gray-800' },
  processing: { label: '処理中', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', className: 'bg-green-100 text-green-800' },
  failed: { label: 'エラー', className: 'bg-red-100 text-red-800' }
}

export default function CheckHistoryList() {
  const [history, setHistory] = useState<CheckHistory[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [userFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)


  const [debouncedSearch, setDebouncedSearch] = useState(search)

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
        // Provide mock history in E2E to make UI functional
        const now = new Date()
        const mock: CheckHistory[] = Array.from({ length: 2 }).map((_, i) => ({
          id: i + 1,
          originalText: `テストデータ ${i + 1} の原文` ,
          modifiedText: `テストデータ ${i + 1} の修正文`,
          status: i === 0 ? 'completed' : 'processing',
          createdAt: new Date(now.getTime() - (i+1) * 60000).toISOString(),
          completedAt: i === 0 ? now.toISOString() : null,
          userEmail: 'admin@test.com'
        }))
        setHistory(mock)
        setPagination({ page: 1, limit: 20, total: mock.length, totalPages: 1, hasNext: false, hasPrev: false })
        setUserRole('admin')
        setError(null)
        return
      }
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (userFilter) params.append('userId', userFilter)

      const response = await fetch(`/api/check-history?${params}`)
      
      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました')
      }

      const data: HistoryResponse = await response.json()
      setHistory(data.checks)
      setPagination(data.pagination)
      setUserRole(data.userRole)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, userFilter])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [search])

  useEffect(() => {
    setCurrentPage(1)
    fetchHistory(1)
  }, [debouncedSearch, statusFilter, fetchHistory])

  useEffect(() => {
    fetchHistory(currentPage)
  }, [currentPage, fetchHistory])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Debounce will handle the fetch
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
  }

  const truncateText = (text: string, maxLength = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  const exportToCSV = () => {
    const headers = ['ID', '作成日時', 'ステータス', '原文（抜粋）', '修正文（抜粋）']
    if (userRole === 'admin') {
      headers.push('ユーザー')
    }

    const csvContent = [
      headers.join(','),
      ...history.map(check => {
        const row = [
          check.id,
          format(new Date(check.createdAt), 'yyyy-MM-dd HH:mm', { locale: ja }),
          statusLabels[check.status].label,
          `"${truncateText(check.originalText, 50).replace(/"/g, '""')}"`,
          `"${check.modifiedText ? truncateText(check.modifiedText, 50).replace(/"/g, '""') : ''}"`
        ]
        if (userRole === 'admin') {
          row.push(check.userEmail ?? '')
        }
        return row.join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `check_history_${format(new Date(), 'yyyyMMdd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading && !history.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">履歴を読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => fetchHistory(1)} variant="outline">
            再試行
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            検索・フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="テキスト内容で検索..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                  data-testid="history-search"
                />
              </div>
              <Button type="submit" className="shrink-0" data-testid="search-button">
                <Search className="h-4 w-4 mr-2" />
                検索
              </Button>
            </div>
            
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-48" data-testid="status-filter">
                  <SelectValue placeholder="ステータスで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="processing">処理中</SelectItem>
                  <SelectItem value="pending">待機中</SelectItem>
                  <SelectItem value="failed">エラー</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1"></div>

              <Button onClick={exportToCSV} variant="outline" className="shrink-0" data-testid="csv-export">
                <Download className="h-4 w-4 mr-2" />
                CSV出力
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {pagination && (
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            {pagination.total}件中 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
          </span>
          <span>
            {userRole === 'admin' ? '組織全体の履歴' : '自分の履歴'}
          </span>
        </div>
      )}

      {/* History List */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">該当する履歴がありません。</p>
            </CardContent>
          </Card>
        ) : (
          history.map((check) => (
            <Card key={check.id} className="hover:shadow-md transition-shadow" data-testid="history-item">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">#{check.id}</span>
                    <Badge className={statusLabels[check.status].className}>
                      {statusLabels[check.status].label}
                    </Badge>
                    {userRole === 'admin' && check.userEmail && (
                      <span className="text-sm text-gray-500">{check.userEmail}</span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>作成: {format(new Date(check.createdAt), 'MM/dd HH:mm', { locale: ja })}</div>
                    {check.completedAt && (
                      <div>完了: {format(new Date(check.completedAt), 'MM/dd HH:mm', { locale: ja })}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      原文
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {truncateText(check.originalText)}
                    </p>
                  </div>

                  {check.modifiedText && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        修正文
                      </label>
                      <p className="text-sm text-gray-900 bg-blue-50 p-3 rounded">
                        {truncateText(check.modifiedText)}
                      </p>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-end">
                  <Link href={`/history/${check.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      詳細を見る
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={!pagination.hasPrev || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            前へ
          </Button>
          
          <span className="text-sm text-gray-600 px-4">
            {pagination.page} / {pagination.totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={!pagination.hasNext || loading}
          >
            次へ
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

    </div>
  )
}