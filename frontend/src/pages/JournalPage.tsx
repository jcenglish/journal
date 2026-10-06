import { useState } from "react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { TrashButton } from "../components/TrashButton";
import { useEntries } from "../hooks/useEntries";
import type { Journal } from "../hooks/useJournals";
import { formatEntryDate, type EntrySummary } from "../lib/entries";
import styles from "./JournalPage.module.css";

interface JournalPageProps {
  journal: Journal;
  onBack: () => void;
  onNewEntry: () => void;
  onOpenEntry: (entryId: number) => void;
}

export function JournalPage({
  journal,
  onBack,
  onNewEntry,
  onOpenEntry,
}: JournalPageProps) {
  const { entries, error, hasMore, loadingMore, loadMore, remove } = useEntries(
    journal.id,
  );
  const [deleting, setDeleting] = useState<EntrySummary | null>(null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="Back"
        >
          ‹
        </button>
        <h1 className={styles.title}>{journal.title}</h1>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {entries && entries.length === 0 && (
        <p className={styles.empty}>No entries yet.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.row}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onOpenEntry(entry.id)}
              >
                <span className={styles.itemDate}>
                  {formatEntryDate(entry.entryDate)}
                </span>
                <span
                  className={
                    entry.title ? styles.itemTitle : styles.itemUntitled
                  }
                >
                  {entry.unreadable
                    ? "Unable to decrypt"
                    : entry.title || "Untitled"}
                </span>
              </button>
              <TrashButton
                label={`Delete entry from ${formatEntryDate(entry.entryDate)}`}
                onClick={() => setDeleting(entry)}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      {deleting && (
        <DeleteConfirmModal
          heading={
            deleting.title && !deleting.unreadable
              ? `Delete "${deleting.title}" (${formatEntryDate(deleting.entryDate)})?`
              : `Delete entry from ${formatEntryDate(deleting.entryDate)}?`
          }
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await remove(deleting.id);
            setDeleting(null);
          }}
        />
      )}

      <button
        type="button"
        className={styles.addButton}
        onClick={onNewEntry}
        aria-label="New entry"
      >
        +
      </button>
    </main>
  );
}
