import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadForm } from "@/app/_components/UploadForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

function file() {
  return new File(["%PDF-1.3 fake"], "invoice.pdf", { type: "application/pdf" });
}

describe("UploadForm", () => {
  it("disables Extract until a file is chosen", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const extract = screen.getByRole("button", { name: "Extract" });
    expect(extract).toBeDisabled();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file());

    expect(extract).toBeEnabled();
  });

  it("uploads the file and redirects to the detail page on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "inv123", status: "needs_review" }), { status: 200 }),
    );

    render(<UploadForm />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file());
    await user.click(screen.getByRole("button", { name: "Extract" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/invoices/inv123"));

    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/invoices");
    expect(opts?.method).toBe("POST");
    expect(opts?.body).toBeInstanceOf(FormData);
  });

  it("shows an error and does not redirect when the upload fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Gemini request failed" }), { status: 500 }),
    );

    render(<UploadForm />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file());
    await user.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByText("Gemini request failed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
