import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkTrusted } from "@/app/invoices/[id]/MarkTrusted";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("MarkTrusted", () => {
  it("disables the button and explains why when flags are open", () => {
    render(<MarkTrusted id="inv1" canTrust={false} openFlags={3} />);

    expect(screen.getByRole("button", { name: "Mark trusted" })).toBeDisabled();
    expect(screen.getByText("Resolve 3 open flags to enable.")).toBeInTheDocument();
  });

  it("uses singular phrasing for exactly one open flag", () => {
    render(<MarkTrusted id="inv1" canTrust={false} openFlags={1} />);
    expect(screen.getByText("Resolve 1 open flag to enable.")).toBeInTheDocument();
  });

  it("enables the button when canTrust is true, with no explanatory text", () => {
    render(<MarkTrusted id="inv1" canTrust={true} openFlags={0} />);

    expect(screen.getByRole("button", { name: "Mark trusted" })).toBeEnabled();
    expect(screen.queryByText(/Resolve/)).not.toBeInTheDocument();
  });

  it("POSTs the trust endpoint and refreshes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "trusted" }), { status: 200 }));

    render(<MarkTrusted id="inv1" canTrust={true} openFlags={0} />);
    await user.click(screen.getByRole("button", { name: "Mark trusted" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/invoices/inv1/trust", { method: "POST" });
  });

  it("shows an error and does not refresh when the server rejects the request", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Cannot mark trusted: 1 open flag(s)" }), { status: 409 }),
    );

    render(<MarkTrusted id="inv1" canTrust={true} openFlags={0} />);
    await user.click(screen.getByRole("button", { name: "Mark trusted" }));

    expect(await screen.findByText("Cannot mark trusted: 1 open flag(s)")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
