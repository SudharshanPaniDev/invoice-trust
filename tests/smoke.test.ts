import { describe, it, expect } from "vitest";

// Phase 0 harness check — proves Vitest runs. Replaced by real rule tests in Phase 2.
describe("smoke", () => {
  it("test harness works", () => {
    expect(1 + 1).toBe(2);
  });
});
