import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoredFields } from "@/app/_components/ScoredFields";
import type { ScoredField } from "@/lib/validation/confidence";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function mkField(overrides: Partial<ScoredField>): ScoredField {
  return {
    value: "some value",
    modelConfidence: 0.9,
    confidence: 0.9,
    verified: false,
    flags: [],
    ...overrides,
  };
}

function vendorRow() {
  return screen.getByText("Vendor").closest("tr")!;
}

describe("ScoredFields — Confidence badge", () => {
  it("shows the percentage and a check for a verified field, no warning icon", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ confidence: 0.9, verified: true }) }} />);
    const row = within(vendorRow());
    expect(row.getByText("90% ✓")).toBeInTheDocument();
    expect(row.queryByText("⚠")).not.toBeInTheDocument();
  });

  it("shows a warning icon for low confidence", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ confidence: 0.3, verified: false }) }} />);
    const row = within(vendorRow());
    expect(row.getByText("⚠")).toBeInTheDocument();
    expect(row.getByText("30%")).toBeInTheDocument();
  });

  it("renders — for a field with no data", () => {
    render(<ScoredFields fields={{}} />);
    // both the empty value and the empty confidence cell fall back to "—"
    expect(within(vendorRow()).getAllByText("—")).toHaveLength(2);
  });
});

describe("ScoredFields — confidence tooltip reasoning", () => {
  it("explains a rule-verified field's ceiling", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ confidence: 0.9, verified: true }) }} />);
    expect(
      within(vendorRow()).getByText(/90% is this system's ceiling even when a check passes/),
    ).toBeInTheDocument();
  });

  it("explains a human-corrected field's ceiling", () => {
    render(
      <ScoredFields
        fields={{ vendorName: mkField({ confidence: 0.95, verified: true, corrected: true }) }}
      />,
    );
    expect(
      within(vendorRow()).getByText(/95% is this system's ceiling for unverifiable fields/),
    ).toBeInTheDocument();
  });

  it("explains an unverifiable field with only a damped model estimate", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ confidence: 0.4, verified: false }) }} />);
    expect(
      within(vendorRow()).getByText(/damped model estimate, not a validated result/),
    ).toBeInTheDocument();
  });

  it("shows the flag reason instead, when the field has an open flag", () => {
    render(
      <ScoredFields
        fields={{ vendorGSTIN: mkField({ confidence: 0.3, flags: ["GSTIN format is invalid"] }) }}
      />,
    );
    const row = within(screen.getByText("GSTIN").closest("tr")!);
    expect(row.getByRole("tooltip")).toHaveTextContent("GSTIN format is invalid");
  });
});

describe("ScoredFields — flags", () => {
  it("renders a flag as a collapsed disclosure with the full reason revealed", () => {
    const flag = "Subtotal 15000.00 + tax 2700.00 = 17700.00, but total says 17000.00";
    render(<ScoredFields fields={{ subtotal: mkField({ confidence: 0.3, flags: [flag] }) }} />);
    const row = screen.getByText("Subtotal").closest("tr")!;
    const disclosure = within(row.querySelector("details")!);

    // truncated summary line and the full-text paragraph both contain the flag text
    expect(disclosure.getByText(`⚠ ${flag}`)).toBeInTheDocument();
    expect(disclosure.getByText(flag)).toBeInTheDocument();
  });
});

describe("ScoredFields — editing", () => {
  it("shows an edit affordance when editInvoiceId is provided", () => {
    render(
      <ScoredFields fields={{ vendorName: mkField({ value: "Acme" }) }} editInvoiceId="inv1" />,
    );
    expect(within(vendorRow()).getByRole("button", { name: "edit" })).toBeInTheDocument();
  });

  it("renders plain text with no edit affordance when editInvoiceId is absent", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ value: "Acme" }) }} />);
    const row = within(vendorRow());
    expect(row.getByText("Acme")).toBeInTheDocument();
    expect(row.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
  });

  it("shows an 'edited' tag for a corrected field", () => {
    render(<ScoredFields fields={{ vendorName: mkField({ value: "Acme", corrected: true }) }} />);
    expect(within(vendorRow()).getByText("edited")).toBeInTheDocument();
  });
});

describe("ScoredFields — provenance selection", () => {
  const bbox: ScoredField["bbox"] = [100, 100, 200, 300];

  it("calls onSelectField when a row with a source location is clicked", async () => {
    const user = userEvent.setup();
    const onSelectField = vi.fn();
    render(
      <ScoredFields
        fields={{ vendorName: mkField({ bbox }) }}
        onSelectField={onSelectField}
      />,
    );
    await user.click(vendorRow());
    expect(onSelectField).toHaveBeenCalledWith("vendorName");
  });

  it("does not attach a click handler when the field has no source location", async () => {
    const user = userEvent.setup();
    const onSelectField = vi.fn();
    render(<ScoredFields fields={{ vendorName: mkField({}) }} onSelectField={onSelectField} />);
    await user.click(vendorRow());
    expect(onSelectField).not.toHaveBeenCalled();
  });

  it("highlights the currently-selected row", () => {
    render(
      <ScoredFields
        fields={{ vendorName: mkField({ bbox }) }}
        selectedField="vendorName"
        onSelectField={vi.fn()}
      />,
    );
    expect(vendorRow().className).toContain("bg-accent/10");
  });
});

describe("ScoredFields — line items", () => {
  it("does not render a line-items section when there are none", () => {
    render(<ScoredFields fields={{ vendorName: mkField({}) }} />);
    expect(screen.queryByText("Line items")).not.toBeInTheDocument();
  });

  it("renders line items when present", () => {
    render(
      <ScoredFields
        fields={{
          "lineItems.0.description": mkField({ value: "Widget" }),
          "lineItems.0.quantity": mkField({ value: "2" }),
          "lineItems.0.unitPrice": mkField({ value: "10.00" }),
          "lineItems.0.lineAmount": mkField({ value: "20.00" }),
        }}
      />,
    );
    expect(screen.getByText("Line items")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
  });
});
