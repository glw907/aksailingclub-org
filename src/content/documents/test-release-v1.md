---
title: "[E2E TEST] Sample Release — season 2024"
document: test-release
version: 1
kind: release
audience: all-members
season: 2024
status: published
---

# E2E test fixture — sample release (season 2024)

This document exists only for `e2e/waivers-signing.spec.ts` and
`e2e/waivers-visual.spec.ts`. It is not a real Alaska Sailing Club waiver, and it
never reaches a real member: `season: 2024` is permanently in the past, so no
production `current_season` (this repo's rolling settings row) ever resolves it
through `resolvePublishedDocuments` in `$theme/documents.ts`.

Signing this fixture waives nothing. It gives the requirement engine and the
signing flow real, published content to render at a season the e2e suite
controls directly.

## Part Two — for a household minor

If I am a parent or guardian signing for a minor in my household, this section is
that child's own election, matching the shape `general-release-v1.md`'s real Part
Two uses.
