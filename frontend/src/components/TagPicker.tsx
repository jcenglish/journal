import { useEffect, useRef, useState } from 'react'
import type { Tag } from '../lib/tags'
import { NewTagModal } from './NewTagModal'
import styles from './TagPicker.module.css'

interface TagPickerProps {
  tags: Tag[] | null
  selectedIds: number[]
  onChange: (ids: number[]) => void
  onCreateTag: (content: string, color: string) => Promise<Tag>
  labelId: string
}

export function TagPicker({ tags, selectedIds, onChange, onCreateTag, labelId }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function toggleTag(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id])
  }

  async function handleCreate(content: string, color: string) {
    const tag = await onCreateTag(content, color)
    if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id])
    setModalOpen(false)
  }

  const selectedTags = (tags ?? []).filter((tag) => selectedIds.includes(tag.id))
  const summary =
    selectedTags.length === 0
      ? 'Select tags'
      : selectedTags.map((tag) => (tag.unreadable ? 'Unreadable tag' : tag.content)).join(', ')

  return (
    <div className={styles.container} ref={containerRef}>
      <span className={styles.label} id={labelId}>
        Tags
      </span>
      <button type="button" className={styles.trigger} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={styles.summary}>{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox" aria-multiselectable="true" aria-labelledby={labelId}>
          {tags === null && <p className={styles.empty}>Loading tags…</p>}
          {tags !== null && tags.length === 0 && <p className={styles.empty}>No tags yet.</p>}
          {tags?.map((tag) => (
            <label key={tag.id} className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selectedIds.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
              />
              <span className={styles.swatch} style={{ background: tag.color }} aria-hidden="true" />
              {tag.unreadable ? 'Unreadable tag' : tag.content}
            </label>
          ))}
          <button
            type="button"
            className={styles.newTag}
            onClick={() => {
              setOpen(false)
              setModalOpen(true)
            }}
          >
            + New tag
          </button>
        </div>
      )}

      {modalOpen && <NewTagModal onCancel={() => setModalOpen(false)} onCreate={handleCreate} />}
    </div>
  )
}
