import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import {
  decryptEntry,
  encryptEntry,
  type Entry,
  type EntryDraft,
} from "../lib/entries";

interface UseEntryResult {
  /** Always null for a new entry; null while an existing one is loading. */
  entry: Entry | null;
  loading: boolean;
  error: string | null;
  /** Resolves with the entry's id once the server has confirmed the save. */
  save: (draft: EntryDraft) => Promise<number>;
}

interface QueuedSave {
  draft: EntryDraft;
  promise: Promise<number>;
}

/**
 * Pass entryId null for a new entry. resumeId is the id of a new entry an
 * earlier session already created, so saves continue it rather than duplicate it.
 */
export function useEntry(
  journalId: number,
  entryId: number | null,
  resumeId: number | null = null,
): UseEntryResult {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savedId = useRef(entryId ?? resumeId);
  const resumed = entryId === null && resumeId !== null;
  const inFlight = useRef<Promise<unknown>>(Promise.resolve());
  const queued = useRef<QueuedSave | null>(null);

  useEffect(() => {
    if (entryId === null) return;

    let cancelled = false;

    api
      .getEntry(journalId, entryId)
      .then(decryptEntry)
      .then((decrypted) => {
        if (cancelled) return;
        setEntry(decrypted);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load this entry.",
        );
      });

    return () => {
      cancelled = true;
      setEntry(null);
      setError(null);
    };
  }, [journalId, entryId]);

  const persist = useCallback(
    async (draft: EntryDraft) => {
      const fields = await encryptEntry(draft);
      if (savedId.current !== null) {
        try {
          await api.updateEntry(journalId, savedId.current, fields);
          return savedId.current;
        } catch (caught) {
          const entryWasDeleted =
            resumed && caught instanceof api.ApiError && caught.status === 404;
          if (!entryWasDeleted) throw caught;
        }
      }
      savedId.current = (await api.createEntry(journalId, fields)).id;
      return savedId.current;
    },
    [journalId, resumed],
  );

  // One request at a time, so a slow older save can't land after a newer one,
  // and two saves of a new entry can't both create it. Saves requested while one
  // is in flight collapse into a single follow-up carrying the newest draft.
  const save = useCallback(
    (draft: EntryDraft) => {
      if (queued.current) {
        queued.current.draft = draft;
        return queued.current.promise;
      }

      const promise = inFlight.current.then(() => {
        const next = queued.current;
        queued.current = null;
        return persist(next!.draft);
      });
      queued.current = { draft, promise };
      inFlight.current = promise.catch(() => undefined);
      return promise;
    },
    [persist],
  );

  const loading = entryId !== null && entry === null && error === null;

  return { entry, loading, error, save };
}
