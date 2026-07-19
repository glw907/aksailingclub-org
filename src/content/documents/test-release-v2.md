---
title: "[E2E TEST] Sample Release — season 2025"
document: test-release
version: 2
kind: release
audience: all-members
season: 2025
status: published
---

# E2E test fixture — sample release (season 2025)

This document exists only for `e2e/waivers-signing.spec.ts` and
`e2e/waivers-visual.spec.ts`. It is not a real Alaska Sailing Club waiver, and it
never reaches a real member: `season: 2025` is permanently in the past, so no
production `current_season` (this repo's rolling settings row) ever resolves it
through `resolvePublishedDocuments` in `$theme/documents.ts`.

This is the next season's own version of `test-release` (decision 6, fresh
signatures every season): a signature recorded against version 1's 2024 season
never satisfies this season's requirement, matching by document id plus season,
never by version.

## Part Two — for a household minor

If I am a parent or guardian signing for a minor in my household, this section is
that child's own election, matching the shape `general-release-v1.md`'s real Part
Two uses.
