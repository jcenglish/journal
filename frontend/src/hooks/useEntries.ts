import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import { decryptEntrySummary, type EntrySummary } from "../lib/entries";

interface UseEntriesResult {
  /** null while the first page is in flight, then always an array. */
  entries: EntrySummary[] | null;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  remove: (entryId: number) => Promise<void>;
}

async function fetchPage(journalId: number, page: number) {
  const record = await api.listEntries(journalId, page);
  return {
    entries: await Promise.all(record.entries.map(decryptEntrySummary)),
    nextPage: record.next_page,
  };
}

function messageFrom(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Unable to load entries.";
}

export function useEntries(journalId: number): UseEntriesResult {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // One token per journal, cancelled when it changes, so a "load more" still in
  // flight for the previous journal can't append its rows to this one.
  const activeLoad = useRef({ cancelled: false });

  useEffect(() => {
    const load = { cancelled: false };
    activeLoad.current = load;

    fetchPage(journalId, 1)
      .then((page) => {
        if (load.cancelled) return;
        setEntries(page.entries);
        setNextPage(page.nextPage);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (load.cancelled) return;
        setError(messageFrom(caught));
      });

    return () => {
      load.cancelled = true;
      setEntries(null);
      setNextPage(null);
      setError(null);
      setLoadingMore(false);
    };
  }, [journalId]);

  const loadMore = useCallback(() => {
    if (nextPage === null || loadingMore) return;

    const load = activeLoad.current;
    setLoadingMore(true);

    fetchPage(journalId, nextPage)
      .then((page) => {
        if (load.cancelled) return;
        setEntries((existing) => [...(existing ?? []), ...page.entries]);
        setNextPage(page.nextPage);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (load.cancelled) return;
        setError(messageFrom(caught));
      })
      .finally(() => {
        if (!load.cancelled) setLoadingMore(false);
      });
  }, [journalId, nextPage, loadingMore]);

  const remove = useCallback(
    async (entryId: number) => {
      const load = activeLoad.current;
      await api.deleteEntry(journalId, entryId);

      setEntries(
        (existing) => existing?.filter((entry) => entry.id !== entryId) ?? null,
      );
      if (nextPage === null) return;

      // Pages are offset-based, so the row that slid up into the last loaded
      // page would otherwise be skipped by the next "load more" — refetch
      // everything loaded so far instead.
      try {
        const pages = await Promise.all(
          Array.from({ length: nextPage - 1 }, (_, index) =>
            fetchPage(journalId, index + 1),
          ),
        );
        if (load.cancelled) return;
        setEntries(pages.flatMap((page) => page.entries));
        setNextPage(pages[pages.length - 1].nextPage);
      } catch (caught) {
        if (load.cancelled) return;
        setError(messageFrom(caught));
      }
    },
    [journalId, nextPage],
  );

  return {
    entries,
    error,
    hasMore: nextPage !== null,
    loadingMore,
    loadMore,
    remove,
  };
}
