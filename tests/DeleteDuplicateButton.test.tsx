import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteDuplicateButton } from "@/app/invoices/[id]/DeleteDuplicateButton";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("DeleteDuplicateButton (D48/D49)", () => {
  it("requires a second click before deleting anything", async () => {
    const user = userEvent.setup();
    render(<DeleteDuplicateButton invoiceId="inv1" />);

    await user.click(screen.getByRole("button", { name: /Delete this upload/ }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteDuplicateButton invoiceId="inv1" />);

    await user.click(screen.getByRole("button", { name: /Delete this upload/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Delete this upload/ })).toBeInTheDocument();
  });

  it("DELETEs the invoice and redirects to the list on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));

    render(<DeleteDuplicateButton invoiceId="inv1" />);
    await user.click(screen.getByRole("button", { name: /Delete this upload/ }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices"));
    expect(fetch).toHaveBeenCalledWith("/api/invoices/inv1", { method: "DELETE" });
  });

  it("shows an error and does not redirect when the server refuses (e.g. flag no longer open)", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Can only delete an invoice that currently has an open hard-duplicate flag" }),
        { status: 409 },
      ),
    );

    render(<DeleteDuplicateButton invoiceId="inv1" />);
    await user.click(screen.getByRole("button", { name: /Delete this upload/ }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(
      await screen.findByText("Can only delete an invoice that currently has an open hard-duplicate flag"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
