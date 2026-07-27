import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmField } from "@/app/invoices/[id]/ConfirmField";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("ConfirmField (D48)", () => {
  it("POSTs the confirm endpoint with the field key and refreshes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    render(<ConfirmField invoiceId="inv1" fieldKey="vendorName" />);
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/invoices/inv1/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ field: "vendorName" }),
      }),
    );
  });

  it("shows an error and does not refresh when the server rejects the request", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Cannot confirm vendorName: no value to confirm" }), { status: 400 }),
    );

    render(<ConfirmField invoiceId="inv1" fieldKey="vendorName" />);
    await user.click(screen.getByRole("button", { name: "confirm" }));

    expect(await screen.findByText("Cannot confirm vendorName: no value to confirm")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
