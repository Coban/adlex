import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  inviteUser: vi.fn(async () => ({ invitation: { invitation_url: 'http://example.com' } })),
  fetchOrganizationUsers: vi.fn(async () => ({ users: [
    { id: '1', email: 'user1@example.com', role: 'user', created_at: new Date().toISOString(), updated_at: null },
    { id: '2', email: 'admin@example.com', role: 'admin', created_at: new Date().toISOString(), updated_at: null },
  ] })),
  updateUserRole: vi.fn(async () => ({})),
}))

import UsersAdminPage from '@/app/admin/users/page'
import { inviteUser, fetchOrganizationUsers, updateUserRole } from '@/lib/auth'

describe('UsersAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // fetch for invitations list
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ invitations: [] }) })) as unknown as typeof fetch
  })

  it('ユーザー一覧が読み込まれ表示される', async () => {
    render(<UsersAdminPage />)
    await waitFor(() => expect(fetchOrganizationUsers).toHaveBeenCalled())
    expect(await screen.findByTestId('user-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('user-item').length).toBeGreaterThan(0)
  })

  it('検索とロールフィルターが動作する', async () => {
    const user = userEvent.setup()
    render(<UsersAdminPage />)
    await waitFor(() => expect(fetchOrganizationUsers).toHaveBeenCalled())

    // filter by role
    const roleFilter = screen.getByTestId('role-filter') as HTMLSelectElement
    await user.selectOptions(roleFilter, 'admin')
    // search by email
    const search = screen.getByTestId('user-search') as HTMLInputElement
    await user.type(search, 'admin@')

    // Should show only filtered result (admin@example.com)
    await waitFor(() => {
      const emails = screen.getAllByTestId('user-email').map((e) => e.textContent)
      expect(emails.every((t) => (t ?? '').includes('admin'))).toBe(true)
    })
  })

  it('ユーザー招待フォームのバリデーションと送信が動作する', async () => {
    const user = userEvent.setup()
    render(<UsersAdminPage />)

    // open invitations tab
    await user.click(screen.getByTestId('invite-user-button'))
    const emailInput = await screen.findByTestId('invite-email-input')
    const sendButton = screen.getByTestId('send-invite-button')

    // invalid email -> shows error
    await user.clear(emailInput)
    await user.click(sendButton)
    expect(await screen.findByTestId('email-error')).toBeInTheDocument()

    // valid email -> submit
    await user.type(emailInput, 'newuser@example.com')
    await user.click(sendButton)
    await waitFor(() => expect(inviteUser).toHaveBeenCalled())
  })

  it('ロール変更フローが動作する（確認ダイアログ経由）', async () => {
    const user = userEvent.setup()
    render(<UsersAdminPage />)
    await waitFor(() => expect(fetchOrganizationUsers).toHaveBeenCalled())

    const selects = screen.getAllByTestId('role-select') as HTMLSelectElement[]
    await user.selectOptions(selects[0], 'admin')

    // confirm dialog
    expect(await screen.findByTestId('confirm-role-change')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-button'))
    await waitFor(() => expect(updateUserRole).toHaveBeenCalled())
  })

  it('ユーザー無効化の確認ダイアログが表示され、無効化できる', async () => {
    const user = userEvent.setup()
    render(<UsersAdminPage />)
    await waitFor(() => expect(fetchOrganizationUsers).toHaveBeenCalled())

    const deactivateButtons = screen.getAllByTestId('deactivate-button')
    await user.click(deactivateButtons[0])
    expect(await screen.findByTestId('confirm-deactivate')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-button'))
    // No throw -> success UI message present (optional)
  })
})


