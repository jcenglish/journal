import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CreateJournalPage } from './CreateJournalPage'

describe('CreateJournalPage', () => {
  it('rejects a blank title without calling onCreate', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<CreateJournalPage onCreate={onCreate} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a title.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only title without calling onCreate', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<CreateJournalPage onCreate={onCreate} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText('Title'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a title.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('calls onCreate with the trimmed plaintext title', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateJournalPage onCreate={onCreate} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText('Title'), '  Morning Pages  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCreate).toHaveBeenCalledWith('Morning Pages')
  })

  it('surfaces an error from onCreate and leaves the form usable', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockRejectedValue(new Error('Request failed with status 500'))
    render(<CreateJournalPage onCreate={onCreate} onBack={vi.fn()} />)

    await user.type(screen.getByLabelText('Title'), 'Morning Pages')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed with status 500')
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('calls onBack when the back button is tapped', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<CreateJournalPage onCreate={vi.fn()} onBack={onBack} />)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })
})
