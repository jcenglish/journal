import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './DeleteConfirmModal.module.css'

interface DeleteConfirmModalProps {
  heading: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({ heading, onCancel, onConfirm }: DeleteConfirmModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  async function handleConfirm() {
    setError(null)
    setPending(true)
    try {
      await onConfirm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
      setPending(false)
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        if (pending) event.preventDefault()
        else onCancel()
      }}
      aria-labelledby={titleId}
    >
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          {heading}
        </h2>
        <p className={styles.message}>This can't be undone.</p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className={styles.confirm} onClick={handleConfirm} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
