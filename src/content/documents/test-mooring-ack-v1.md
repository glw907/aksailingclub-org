---
title: "[E2E TEST] Sample Mooring Acknowledgement — season 2025"
document: test-mooring-ack
version: 1
kind: acknowledgement
audience: mooring
season: 2025
status: published
---

# E2E test fixture — sample mooring acknowledgement (season 2025)

This document exists only for `e2e/waivers-visual.spec.ts`. It is not a real
Alaska Sailing Club mooring document, and it never reaches a real member:
`season: 2025` is permanently in the past, so no production `current_season`
ever resolves it.

This is the suite's household-scoped document, held by a member of a household
carrying a `mooring` asset, so the contact-confirm glance card has a real
household to exercise once every personal and household document is signed.
