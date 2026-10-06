import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("renders the empty state when there are no journals", () => {
    render(
      <HomePage
        journals={[]}
        error={null}
        onNewJournal={vi.fn()}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No journals yet — tap + to create your first one."),
    ).toBeInTheDocument();
  });

  it("renders decrypted journal titles", () => {
    render(
      <HomePage
        journals={[
          {
            id: 1,
            title: "Morning Pages",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: 2,
            title: "Gratitude Log",
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ]}
        error={null}
        onNewJournal={vi.fn()}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    expect(screen.getByText("Morning Pages")).toBeInTheDocument();
    expect(screen.getByText("Gratitude Log")).toBeInTheDocument();
    expect(
      screen.queryByText("No journals yet — tap + to create your first one."),
    ).not.toBeInTheDocument();
  });

  it("shows nothing list-related while the initial fetch is in flight", () => {
    render(
      <HomePage
        journals={null}
        error={null}
        onNewJournal={vi.fn()}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("No journals yet — tap + to create your first one."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("surfaces a load error", () => {
    render(
      <HomePage
        journals={null}
        error="Unable to load journals."
        onNewJournal={vi.fn()}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load journals.",
    );
  });

  it("calls onNewJournal when the add button is tapped", async () => {
    const user = userEvent.setup();
    const onNewJournal = vi.fn();
    render(
      <HomePage
        journals={[]}
        error={null}
        onNewJournal={onNewJournal}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "New journal" }));

    expect(onNewJournal).toHaveBeenCalled();
  });

  it("calls onLogOut when the log out button is tapped", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    render(
      <HomePage
        journals={[]}
        error={null}
        onNewJournal={vi.fn()}
        onOpenJournal={vi.fn()}
        onDeleteJournal={vi.fn()}
        onLogOut={onLogOut}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(onLogOut).toHaveBeenCalled();
  });

  it("calls onOpenJournal with the journal id when a row is tapped", async () => {
    const user = userEvent.setup();
    const onOpenJournal = vi.fn();
    render(
      <HomePage
        journals={[
          {
            id: 7,
            title: "Morning Pages",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
        error={null}
        onNewJournal={vi.fn()}
        onOpenJournal={onOpenJournal}
        onDeleteJournal={vi.fn()}
        onLogOut={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Morning Pages" }));

    expect(onOpenJournal).toHaveBeenCalledWith(7);
  });
  describe("deleting", () => {
    const journals = [
      { id: 1, title: "Morning Pages", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, title: "Gratitude Log", createdAt: "2026-01-02T00:00:00.000Z" },
    ];

    function renderWithDelete(
      onDeleteJournal = vi.fn().mockResolvedValue(undefined),
    ) {
      render(
        <HomePage
          journals={journals}
          error={null}
          onNewJournal={vi.fn()}
          onOpenJournal={vi.fn()}
          onDeleteJournal={onDeleteJournal}
          onLogOut={vi.fn()}
        />,
      );
      return onDeleteJournal;
    }

    it("opens the confirm modal from the trash button without deleting yet", async () => {
      const user = userEvent.setup();
      const onDeleteJournal = renderWithDelete();

      await user.click(
        screen.getByRole("button", { name: "Delete Morning Pages" }),
      );

      expect(
        screen.getByRole("dialog", { name: 'Delete "Morning Pages"?' }),
      ).toBeInTheDocument();
      expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
      expect(onDeleteJournal).not.toHaveBeenCalled();
    });

    it("deletes the journal and closes the modal when confirmed", async () => {
      const user = userEvent.setup();
      const onDeleteJournal = renderWithDelete();

      await user.click(
        screen.getByRole("button", { name: "Delete Gratitude Log" }),
      );
      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(onDeleteJournal).toHaveBeenCalledWith(2);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does nothing when canceled", async () => {
      const user = userEvent.setup();
      const onDeleteJournal = renderWithDelete();

      await user.click(
        screen.getByRole("button", { name: "Delete Morning Pages" }),
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onDeleteJournal).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Morning Pages")).toBeInTheDocument();
    });

    it("keeps the modal open and shows the error when the delete fails", async () => {
      const user = userEvent.setup();
      renderWithDelete(vi.fn().mockRejectedValue(new Error("Not found")));

      await user.click(
        screen.getByRole("button", { name: "Delete Morning Pages" }),
      );
      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
