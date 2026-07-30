# Assets pass (the design-capture trial): cairn DX harvest findings

> Staging file for cairn-cms's `docs/internal/docs-friction-log.md`, same precedent as the
> Classes pass: a cairn worktree (`design-infra-pass-2`) still had live workerd processes at
> 2026-07-29 prep, so nothing writes into that repo from here. Paste these into the friction log
> when cairn is free, then delete this file. The frame (Geoff, 2026-07-21): the component library
> improves as we go, so each finding is an improvement to make rather than a complaint to archive.

## Filed at pass prep (2026-07-29, the pre-trial chores)

1. **cairn 0.91.0 silently killed 300 consumer markup sites, and shipped as non-breaking
   (defect, high).** The release migrated cairn's own admin screens onto the new `type-*` roles.
   Tailwind therefore stopped generating the named size steps into
   `dist/components/cairn-admin.css`, and every consumer admin site that reached cairn's sheet for
   one of those utilities lost it on the bump. Measured against the two shipped sheets and
   confirmed by the audit's own before/after on ASC:

   | Class | 0.90.1 sheet | 0.91.0 sheet | ASC sites |
   | --- | :---: | :---: | ---: |
   | `text-sm` | yes | no | 239 |
   | `text-xs` | yes | no | 24 |
   | `text-lg` | yes | no | 23 |
   | `gap-6` | yes | no | 9 |
   | `text-2xl` | yes | no | 3 |
   | `tracking-tight` | yes | no | 2 |

   The upgrade guide's adoption recipe says the opposite: "When you cross `0.91.0`, the release
   that ships the admin grammar tokens, your custom admin screens keep rendering exactly as they
   did." For any consumer whose admin markup reaches cairn's sheet for a named size step, that
   sentence is false, and it is the sentence a consumer reads before deciding the upgrade is safe.

   What makes this worth filing rather than shrugging at: **cairn already understood the
   mechanism and applied the remedy to the new names only.** The changelog states that the
   grammar utilities "ship in the compiled admin stylesheet whether or not cairn's own screens
   use them, so a role is available to a custom admin route on the strength of the documentation
   alone." That is exactly the reachability argument the retired names needed, and they did not
   get it. The safelist protected what cairn was adding and not what cairn was taking away.

   Two candidate remedies. Either safelist the retired named steps for a deprecation window, so
   the rename becomes the mechanical adoption the guide already describes, or reclassify the
   release as breaking, correct the guide's promise, and make the rename recipe mandatory rather
   than optional. The first is cheaper for every consumer; the second is honest about what
   shipped. Doing neither leaves a consumer's admin quietly changing size on a minor bump.

2. **A consumer's reachable class vocabulary is whatever cairn's own admin happens to use
   (design gap, medium).** This is the root cause behind the Classes pass's finding 2, and
   `cairn-audit` measures it now without changing it. After the type sweep, ASC still carries 94
   dead classes across 17 admin screens, and they are not exotic: `w-fit`, `max-w-none`,
   `first:pt-0`, `last:pb-0`, `gap-x-6`, `gap-y-4`, `align-top`, `whitespace-pre-line`, the whole
   `print:*` family on the signature certificate, and most responsive variants (`xl:grid-cols-4`,
   `sm:col-span-2`, `lg:stats-horizontal`). Each one read as live markup and compiled to nothing.

   A developer writing an admin screen has no way to know which utilities are reachable except by
   running the audit and reading the failures, which makes the audit a discovery tool for a
   constraint that is nowhere stated as a contract. Three shapes of remedy worth weighing: publish
   the reachable-utility surface as a documented list, give consumers a supported seam to extend
   the admin sheet with their own Tailwind pass, or state the constraint prominently enough that
   `<style>`-block scoping reads as the expected idiom rather than an escape hatch. ASC has now
   taken the third route by hand four times in four different files.

3. **`cairn-audit` cannot scope to a path, but the done-gate asks a builder to (DX, low).** The
   skill's done-gate says to run the static audit "against the routes and components you touched."
   The CLI's usage is `cairn-audit [--rendered] [--config <path>]`, with no positional path filter,
   so the only way to narrow a run is to author a config file naming `static.scope`. On a consumer
   with pre-existing findings elsewhere, a builder cannot tell their own errors from inherited ones
   without that ceremony. A positional path argument would close it.

4. **The static scan cannot see a class string a plain `.ts` module exports, and no config fixes
   it (coverage gap, medium).** The substrate is `svelte/compiler` over markup, which is what makes
   the rest of the engine trustworthy, and it also means a consumer who centralizes admin class
   vocabulary in TypeScript gets zero coverage there while the run reports clean. ASC keeps its
   chip and label vocabulary in `src/admin-club/lib/` (34 `.ts` files, no components). Adding that
   directory to `static.scope` changes nothing: the file count stays 29, because there is no
   `.svelte` in it to compile. Verified that the config was genuinely read by appending a
   nonexistent path and watching the run fail loudly, exactly as documented.

   Two concrete costs measured here. Seven of ASC's 21 `badge-ghost` sites lived in those modules,
   so a consumer following the `Consumers must:` line by audit output alone migrates 14 of 21 and
   believes the job done. Worse, `HEADER_CELL` (the shared uppercase micro-label on every table
   column header, 118 uses across 18 screens) carried `text-[0.6875rem]`, which never compiled, so
   the admin's most-used label recipe rendered at the inherited size for its entire life with a
   green gate above it. The audit found none of it.

   Centralizing a class string in a module is good practice, not an edge case, and it is the
   pattern most likely to hold a site's design vocabulary. Worth either extending the static
   substrate to string literals in `.ts` files under scope (accepting that some will be false
   positives) or stating the limitation in the reference, so a consumer knows the gate's blind
   spot rather than inferring coverage it does not have.

5. **The closed type scale has no 12px role, so `text-xs` has no mechanical target
   (observation, feeds the trial ratchet).** The scale runs 13px (`meta`) then 11px (`label`).
   Tailwind's `text-xs` is 12px, so every consumer site carrying it faces a judgment call and a
   visible size change in one direction or the other. Cairn hit the same wall internally and
   resolved 120 twelve-pixel sites "by the relationship each site expresses," which is the right
   answer and also an unsignposted one: the upgrade guide's step 2 tells a reader to "match that
   size to a grammar role," and for 12px no match exists. ASC resolved its 24 sites the same way
   cairn did. Either document the 12px case explicitly in the adoption recipe or reconsider
   whether the scale is closed in the right place.

6. **`cairn-doctor`'s zone checks report a bare 403 on read (DX, low).** Always Use HTTPS and HSTS
   both fail with "read returned 403" using the standard project token, then print a fix that
   assumes the setting is off. The check cannot distinguish "the zone setting is wrong" from "this
   token cannot read zone settings," and it reports the first while measuring the second. Naming
   the scope the read needs would make the failure actionable.
