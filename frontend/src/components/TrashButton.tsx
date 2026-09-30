import styles from './TrashButton.module.css'

interface TrashButtonProps {
  label: string
  onClick: () => void
}

export function TrashButton({ label, onClick }: TrashButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  )
}
