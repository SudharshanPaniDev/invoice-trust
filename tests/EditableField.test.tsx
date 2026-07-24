import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableField } from "@/app/invoices/[id]/EditableField";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("EditableField", () => {
  it("shows the value and enters edit mode on the edit button", async () => {
    const user = userEvent.setup();
    render(<EditableField invoiceId="inv1" fieldKey="vendorName" value="Acme" />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "edit" }));

    expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cancel" })).toBeInTheDocument();
  });

  it("saves on Enter, PATCHes the invoice, and refreshes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    render(<EditableField invoiceId="inv1" fieldKey="vendorName" value="Acme" />);
    await user.click(screen.getByRole("button", { name: "edit" }));

    const input = screen.getByDisplayValue("Acme");
    await user.clear(input);
    await user.type(input, "New Vendor{Enter}");

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(
      "/api/invoices/inv1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ field: "vendorName", value: "New Vendor" }),
      }),
    );
    // exits edit mode
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
  });

  it("shows an error and stays in edit mode when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Save failed" }), { status: 400 }),
    );

    render(<EditableField invoiceId="inv1" fieldKey="vendorName" value="Acme" />);
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cancels without saving on Escape", async () => {
    const user = userEvent.setup();
    render(<EditableField invoiceId="inv1" fieldKey="vendorName" value="Acme" />);
    await user.click(screen.getByRole("button", { name: "edit" }));

    await user.type(screen.getByDisplayValue("Acme"), "{Escape}");

    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels without saving on the cancel button", async () => {
    const user = userEvent.setup();
    render(<EditableField invoiceId="inv1" fieldKey="vendorName" value="Acme" />);
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
