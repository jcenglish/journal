import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContentEditor } from './ContentEditor'

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function renderEditor(onChange = vi.fn()) {
  render(
    <>
      <span id="content-label">Content</span>
      <ContentEditor initialContent={doc('Feeling steady today')} onChange={onChange} labelId="content-label" />
    </>,
  )
  return onChange
}

describe('ContentEditor', () => {
  it('renders the initial document as a labelled textbox', async () => {
    renderEditor()

    const textbox = await screen.findByRole('textbox', { name: 'Content' })
    expect(textbox).toHaveTextContent('Feeling steady today')
  })

  it('reports the whole ProseMirror document when formatting changes it', async () => {
    const user = userEvent.setup()
    const onChange = renderEditor()
    await screen.findByRole('textbox', { name: 'Content' })

    await user.click(screen.getByRole('button', { name: 'Bullet list' }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const [latest] = onChange.mock.lastCall!
    expect(latest.type).toBe('doc')
    expect(latest.content[0]).toEqual({
      type: 'bulletList',
      content: [{ type: 'listItem', content: [doc('Feeling steady today').content[0]] }],
    })
    expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('enables undo only once there is something to undo', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole('textbox', { name: 'Content' })

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Bullet list' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  })
})
