import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RatingSelector } from './RatingSelector'

describe('RatingSelector', () => {
  it('offers exactly the ratings 1 through 5', () => {
    render(<RatingSelector legend="Mood" name="mood" value={null} onChange={vi.fn()} />)

    const group = screen.getByRole('group', { name: 'Mood' })
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('value'))
    expect(labels).toEqual(['1', '2', '3', '4', '5'])
  })

  it('checks the current value', () => {
    render(<RatingSelector legend="Mood" name="mood" value={3} onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: '3' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '4' })).not.toBeChecked()
  })

  it('reports the chosen rating as a number', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RatingSelector legend="Health" name="health" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: '4' }))

    expect(onChange).toHaveBeenCalledWith(4)
  })
})
