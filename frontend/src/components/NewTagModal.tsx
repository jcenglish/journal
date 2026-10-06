import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./NewTagModal.module.css";

// A small fixed palette rather than a free color picker — plain and boring
// per the frontend styling baseline (see CLAUDE.md).
const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#2563eb",
  "#7c3aed",
];

interface NewTagModalProps {
  onCancel: () => void;
  onCreate: (content: string, color: string) => Promise<void>;
}

export function NewTagModal({ onCancel, onCreate }: NewTagModalProps) {
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // React bubbles portal events through the component tree, not the DOM
    // tree — without this, submitting this form would also submit the entry
    // form this picker lives in.
    event.stopPropagation();

    // There's no server-side blank check — the server only ever sees
    // ciphertext, so this has to be caught before encryption/sending.
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Please enter a tag name.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await onCreate(trimmed, color);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setPending(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={onCancel}
      aria-labelledby={`${ids}-title`}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 id={`${ids}-title`} className={styles.title}>
          New Tag
        </h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids}-name`}>
            Name
          </label>
          <input
            id={`${ids}-name`}
            className={styles.input}
            type="text"
            value={content}
            required
            autoFocus
            onChange={(event) => setContent(event.target.value)}
          />
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Color</legend>
          <div className={styles.swatches}>
            {TAG_COLORS.map((option) => (
              <label key={option} className={styles.swatchOption}>
                <input
                  type="radio"
                  className={styles.swatchInput}
                  name={`${ids}-color`}
                  value={option}
                  checked={color === option}
                  onChange={() => setColor(option)}
                />
                <span
                  className={styles.swatch}
                  style={{ background: option }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button type="submit" className={styles.create} disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
