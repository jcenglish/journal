import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Tag } from '../lib/tags'
import { TagPicker } from './TagPicker'

const tags: Tag[] = [
  { id: 1, content: 'gratitude', color: '#2563eb' },
  { id: 2, content: 'work', color: '#ef4444' },
]

describe('TagPicker', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<TagPicker tags={tags} selectedIds={[]} onChange={vi.fn()} onCreateTag={vi.fn()} labelId="tags" />)

    expect(screen.getByRole('button', { name: 'Select tags' })).toBeInTheDocument()
  })

  it('shows the names of selected tags', () => {
    render(<TagPicker tags={tags} selectedIds={[1]} onChange={vi.fn()} onCreateTag={vi.fn()} labelId="tags" />)

    expect(screen.getByRole('button', { name: 'gratitude' })).toBeInTheDocument()
  })

  it('opens the dropdown and toggles a tag on', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagPicker tags={tags} selectedIds={[]} onChange={onChange} onCreateTag={vi.fn()} labelId="tags" />)

    await user.click(screen.getByRole('button', { name: 'Select tags' }))
    await user.click(screen.getByRole('checkbox', { name: 'gratitude' }))

    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('toggles a selected tag back off', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagPicker tags={tags} selectedIds={[1, 2]} onChange={onChange} onCreateTag={vi.fn()} labelId="tags" />)

    await user.click(screen.getByRole('button', { name: 'gratitude, work' }))
    await user.click(screen.getByRole('checkbox', { name: 'gratitude' }))

    expect(onChange).toHaveBeenCalledWith([2])
  })

  it('opens the new tag modal from the dropdown', async () => {
    const user = userEvent.setup()
    render(<TagPicker tags={tags} selectedIds={[]} onChange={vi.fn()} onCreateTag={vi.fn()} labelId="tags" />)

    await user.click(screen.getByRole('button', { name: 'Select tags' }))
    await user.click(screen.getByRole('button', { name: '+ New tag' }))

    expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument()
  })

  it('selects a newly created tag and closes the modal', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const newTag: Tag = { id: 9, content: 'travel', color: '#22c55e' }
    const onCreateTag = vi.fn().mockResolvedValue(newTag)
    render(<TagPicker tags={tags} selectedIds={[]} onChange={onChange} onCreateTag={onCreateTag} labelId="tags" />)

    await user.click(screen.getByRole('button', { name: 'Select tags' }))
    await user.click(screen.getByRole('button', { name: '+ New tag' }))
    await user.type(screen.getByLabelText('Name'), 'travel')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(onCreateTag).toHaveBeenCalledWith('travel', expect.any(String))
    expect(onChange).toHaveBeenCalledWith([9])
    expect(screen.queryByRole('heading', { name: 'New Tag' })).not.toBeInTheDocument()
  })
})
