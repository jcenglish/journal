import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraft } from "../lib/drafts";
import { InvalidEntryError, type EntryDraft } from "../lib/entries";
import { useAutosave } from "./useAutosave";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const KEY = "draft-key";

const draft = (title: string): EntryDraft => ({
  entryDate: "2026-09-05",
  title,
  content: { type: "doc", content: [{ type: "paragraph" }] },
  mood: 3,
  health: 3,
  tagIds: [],
});

function setup(
  save = vi.fn<(draft: EntryDraft) => Promise<number>>(async () => 7),
) {
  const hook = renderHook(() =>
    useAutosave({ draftKey: KEY, save, initialServerId: null, delayMs: 1000 }),
  );
  return { save, ...hook };
}

describe("useAutosave", () => {
  it("caches the draft locally on every change, before any save", () => {
    const { result, save } = setup();

    act(() => result.current.change(draft("a")));

    expect(loadDraft(KEY)?.draft.title).toBe("a");
    expect(save).not.toHaveBeenCalled();
  });

  it("flags when the local draft cannot be written, and clears the flag once the server confirms", async () => {
    const blocked = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    const { result, save } = setup();

    act(() => result.current.change(draft("a")));
    expect(result.current.draftStorageFailed).toBe(true);
    blocked.mockRestore();

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.draftStorageFailed).toBe(false);
  });

  it("saves once, with the latest draft, after the user stops changing it", async () => {
    const { result, save } = setup();

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(900));
    act(() => result.current.change(draft("ab")));
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(save).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(draft("ab"));
  });

  it("clears the local draft once the server confirms", async () => {
    const { result } = setup();

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(loadDraft(KEY)).toBeNull();
    expect(result.current.status).toBe("saved");
  });

  it("keeps the draft when the user kept typing while the save was in flight", async () => {
    let confirm: (id: number) => void = () => {};
    const save = vi.fn(
      () => new Promise<number>((resolve) => (confirm = resolve)),
    );
    const { result } = setup(save);

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.change(draft("ab")));
    await act(async () => confirm(7));

    expect(loadDraft(KEY)).toEqual({ draft: draft("ab"), serverId: 7 });
    expect(result.current.status).not.toBe("saved");
  });

  it("keeps the draft and reports an error when the save fails", async () => {
    const save = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = setup(save);

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(loadDraft(KEY)?.draft.title).toBe("a");
    expect(result.current.status).toBe("error");
  });

  it("leaves an unfinished entry as a local draft without reporting an error", async () => {
    const save = vi.fn(async () => {
      throw new InvalidEntryError("Please choose a mood from 1 to 5.");
    });
    const { result } = setup(save);

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(loadDraft(KEY)?.draft.title).toBe("a");
    expect(result.current.status).toBe("idle");
  });

  it("records the id of the entry an autosave created", async () => {
    let confirm: (id: number) => void = () => {};
    const save = vi.fn(
      () => new Promise<number>((resolve) => (confirm = resolve)),
    );
    const { result } = setup(save);

    act(() => result.current.change(draft("a")));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => result.current.change(draft("ab")));
    await act(async () => confirm(12));

    expect(loadDraft(KEY)?.serverId).toBe(12);
  });

  it("saves immediately when the tab is hidden", async () => {
    const { result, save } = setup();
    act(() => result.current.change(draft("a")));

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("attempts a save on beforeunload", async () => {
    const { result, save } = setup();
    act(() => result.current.change(draft("a")));

    await act(async () => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves pending changes when the editor unmounts", async () => {
    const { result, save, unmount } = setup();
    act(() => result.current.change(draft("a")));

    unmount();

    expect(save).toHaveBeenCalledWith(draft("a"));
  });

  it("does nothing when there is nothing unsaved", async () => {
    const { save, unmount } = setup();

    unmount();

    expect(save).not.toHaveBeenCalled();
  });
});
