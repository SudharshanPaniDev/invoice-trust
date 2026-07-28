import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuplicateResolution } from "@/app/invoices/[id]/DuplicateResolution";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("DuplicateResolution — delete side (D48/D49)", () => {
  it("requires a second click before deleting anything", async () => {
    const user = userEvent.setup();
    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);

    await user.click(screen.getByRole("button", { name: "Yes, same document" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);

    await user.click(screen.getByRole("button", { name: "Yes, same document" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Yes, same document" })).toBeInTheDocument();
  });

  it("DELETEs the invoice and redirects to the list on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));

    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);
    await user.click(screen.getByRole("button", { name: "Yes, same document" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices"));
    expect(fetch).toHaveBeenCalledWith("/api/invoices/inv1", { method: "DELETE" });
  });

  it("shows an error and does not redirect when the server refuses (e.g. no longer a candidate)", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Can only delete an invoice that currently has an open duplicate candidate" }),
        { status: 409 },
      ),
    );

    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);
    await user.click(screen.getByRole("button", { name: "Yes, same document" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(
      await screen.findByText("Can only delete an invoice that currently has an open duplicate candidate"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("DuplicateResolution — dismiss side (D53)", () => {
  it("posts a dismissal with the matched invoice id and refreshes on success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ dismissed: "inv2" }), { status: 200 }));
    const user = userEvent.setup();

    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);
    await user.click(screen.getByRole("button", { name: "Not a duplicate" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/invoices/inv1/dismiss-duplicate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ matchedInvoiceId: "inv2" }),
      }),
    );
  });

  it("shows an error and does not refresh when the dismissal fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Dismiss failed" }), { status: 400 }));
    const user = userEvent.setup();

    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);
    await user.click(screen.getByRole("button", { name: "Not a duplicate" }));

    expect(await screen.findByText("Dismiss failed")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not delete anything when dismissing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ dismissed: "inv2" }), { status: 200 }));
    const user = userEvent.setup();

    render(<DuplicateResolution invoiceId="inv1" matchId="inv2" />);
    await user.click(screen.getByRole("button", { name: "Not a duplicate" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
