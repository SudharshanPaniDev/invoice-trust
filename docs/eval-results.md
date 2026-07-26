# Eval run

Scripted regression checks: 6/6 passed.

## Clean invoice (scripted — should fully pass)

- isInvoice: true
- canTrust: true
- overall confidence: 86%
- fields scored: 14 (high 11 / medium 3 / low 0)
- flags: none
- **scripted check:** [PASS] canTrust=true (expected true)
- **scripted check:** [PASS] openFlags=0 (expected 0)

## Invalid GSTIN (scripted — checksum must fail)

- isInvoice: true
- canTrust: false
- overall confidence: 82%
- fields scored: 18 (high 13 / medium 4 / low 1)
- flags:
  - vendorGSTIN: GSTIN checksum failed (expected 'A', got 'T')
- **scripted check:** [PASS] canTrust=false (expected false)
- **scripted check:** [PASS] vendorGSTIN flags=["GSTIN checksum failed (expected 'A', got 'T')"]

## Arithmetic mismatch (scripted — total.sum must fail)

- isInvoice: true
- canTrust: false
- overall confidence: 75%
- fields scored: 18 (high 11 / medium 4 / low 3)
- flags:
  - subtotal: Subtotal 15000.00 + tax 2700.00 = 17700.00, but total says 17000.00
  - taxAmount: Subtotal 15000.00 + tax 2700.00 = 17700.00, but total says 17000.00
  - total: Subtotal 15000.00 + tax 2700.00 = 17700.00, but total says 17000.00
- **scripted check:** [PASS] canTrust=false (expected false)
- **scripted check:** [PASS] total flags=["Subtotal 15000.00 + tax 2700.00 = 17700.00, but total says 17000.00"]

## Scanned copy (unscripted)

- isInvoice: true
- canTrust: true
- overall confidence: 85%
- fields scored: 22 (high 17 / medium 5 / low 0)
- flags: none

## Phone photo (unscripted)

- isInvoice: true
- canTrust: true
- overall confidence: 85%
- fields scored: 22 (high 17 / medium 5 / low 0)
- flags: none

## Stamped/annotated scan (unscripted)

- isInvoice: true
- canTrust: true
- overall confidence: 85%
- fields scored: 22 (high 17 / medium 5 / low 0)
- flags: none

## Multi-page invoice (unscripted)

- isInvoice: true
- canTrust: true
- overall confidence: 85%
- fields scored: 50 (high 38 / medium 12 / low 0)
- flags: none

## Missing/illegible fields (unscripted)

- isInvoice: true
- canTrust: true
- overall confidence: 84%
- fields scored: 20 (high 14 / medium 6 / low 0)
- flags: none
