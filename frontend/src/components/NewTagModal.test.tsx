import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewTagModal } from "./NewTagModal";

describe("NewTagModal", () => {
  it("requires a name before creating", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<NewTagModal onCancel={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a tag name.",
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("creates with the entered name and selected color", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewTagModal onCancel={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "gratitude");
    const colorOptions = screen.getAllByRole("radio");
    await user.click(colorOptions[2]);
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith(
      "gratitude",
      colorOptions[2].getAttribute("value"),
    );
  });

  it("trims whitespace from the name", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<NewTagModal onCancel={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "  gratitude  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith("gratitude", expect.any(String));
  });

  it("shows an error and re-enables the form when creation fails", async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error("Something went wrong."));
    render(<NewTagModal onCancel={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "gratitude");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NewTagModal onCancel={onCancel} onCreate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
