import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the empty state when there are no journals', () => {
    render(<HomePage journals={[]} error={null} onNewJournal={vi.fn()} onLogOut={vi.fn()} />)

    expect(screen.getByText('No journals yet — tap + to create your first one.')).toBeInTheDocument()
  })

  it('renders decrypted journal titles', () => {
    render(
      <HomePage
        journals={[
          { id: 1, title: 'Morning Pages', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 2, title: 'Gratitude Log', createdAt: '2026-01-02T00:00:00.000Z' },
        ]}
        error={null}
        onNewJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    )

    expect(screen.getByText('Morning Pages')).toBeInTheDocument()
    expect(screen.getByText('Gratitude Log')).toBeInTheDocument()
    expect(screen.queryByText('No journals yet — tap + to create your first one.')).not.toBeInTheDocument()
  })

  it('shows nothing list-related while the initial fetch is in flight', () => {
    render(<HomePage journals={null} error={null} onNewJournal={vi.fn()} onLogOut={vi.fn()} />)

    expect(screen.queryByText('No journals yet — tap + to create your first one.')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('surfaces a load error', () => {
    render(<HomePage journals={null} error="Unable to load journals." onNewJournal={vi.fn()} onLogOut={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load journals.')
  })

  it('calls onNewJournal when the add button is tapped', async () => {
    const user = userEvent.setup()
    const onNewJournal = vi.fn()
    render(<HomePage journals={[]} error={null} onNewJournal={onNewJournal} onLogOut={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'New journal' }))

    expect(onNewJournal).toHaveBeenCalled()
  })

  it('calls onLogOut when the log out button is tapped', async () => {
    const user = userEvent.setup()
    const onLogOut = vi.fn()
    render(<HomePage journals={[]} error={null} onNewJournal={vi.fn()} onLogOut={onLogOut} />)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(onLogOut).toHaveBeenCalled()
  })
})
