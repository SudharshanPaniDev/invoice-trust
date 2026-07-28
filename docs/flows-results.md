17/17 checks passed.

# End-to-end flow check (D57)

- **[PASS]** vendor filter finds exactly the 5 test invoices
- **[PASS]** status filter finds all 5 (none trusted yet)
- **[PASS]** blocked while the arithmetic flag is open
- **[PASS]** confirm earns 85% and tags the field 'confirmed'
- **[PASS]** bad total starts flagged
- **[PASS]** correcting the total clears the arithmetic flag
- **[PASS]** corrected value is tagged 'edited'
- **[PASS]** Mark trusted is now enabled
- **[PASS]** marking trusted succeeds
- **[PASS]** possible-duplicate resolution UI appears on the Invoice No row
- **[PASS]** dismissing clears the duplicate flag for this pair
- **[PASS]** the other half of the dismissed pair is clear too
- **[PASS]** deleting the duplicate redirects to the list
- **[PASS]** the deleted invoice is actually gone
- **[PASS]** the surviving invoice is no longer flagged as a duplicate
- **[PASS]** export includes the now-trusted flow-test invoice
- **[PASS]** export excludes still-needs_review invoices (trusted-only default)