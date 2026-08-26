<!--
@component
The Club section's Email screen: the template list (office idiom, one row per `email_templates`
row, linking to its edit screen) and the send log (every attempted `email_log` send, newest
first), behind one `aria-pressed` Templates/Send log switcher (client `$state`, the Assets
screen's own switcher idiom), plus the header's own "Compose" entry point into the segment-
targeted one-off Compose screen (`/admin/club/email/compose`).

**Send-log presentation (Email + Announce pass, Task 6; probe verdicts 1 and 2,
`docs/plans/2026-08-25-email-announce.md`).** The whole log arrives loaded (`+page.server.ts`'s
own `EMAIL_LOG_GUARD_LIMIT` read); grouping (`email-log-groups.ts`'s pure fold, a run of failed
rows sharing one `error_detail` chained at gaps under an hour), the outcome/template filters, and
pagination all run client side over that fully loaded set -- no filter, view, or page value ever
reaches SQL or the URL, matching `assets/+page.svelte`'s and `members/+page.svelte`'s own
client-state idiom for this shape of screen. An incident row sits on the plain row ground (probe
verdict 1: the warning chip alone carries the tone, not a tinted row); its expanded state inlines
each member send as its own row (each carrying its own Failed chip) plus an in-incident pager,
with the chronology's own sent rows continuing below (probe verdict 2). The template filter
narrows WITHIN a group: a template-filtered incident states its own filtered count rather than
disappearing or over-reporting the full incident size.

Every chip on this screen rides `$theme/admin-chip-registers.css`'s tinted-ground registers
(the assets-register pass's stylesheet): Sent on the quiet tint, Failed on the warning tint,
each inside its own marker span.
-->
<script lang="ts">
  import type { PageData } from './$types';
  import { EmptyState, OfficeList, Pagination, StatusChip, computeCountLine, itemNoun } from '@glw907/cairn-cms/admin-toolkit';
  import { HEADER_CELL, formatClubTimestamp } from '$admin-club/lib/ui';
  import { groupEmailLog, type EmailLogIncident, type EmailLogSingleRow } from '$admin-club/lib/email-log-groups';
  // The register re-entry's shared chip stylesheet (assets-register Task 1): a per-page
  // side-effect import, this screen's own marker spans below key off it.
  import '$theme/admin-chip-registers.css';

  let { data }: { data: PageData } = $props();

  type View = 'templates' | 'log';
  let view = $state<View>('templates');

  const VIEW_TABS: { id: View; label: string }[] = [
    { id: 'templates', label: 'Templates' },
    { id: 'log', label: 'Send log' },
  ];

  // -- send-log grouping and filtering (client state over the fully loaded read; Global
  //    constraints, "The send log's view selection, filters, and page number are client
  //    state over a fully loaded row set") --

  /** The fold's own incident, narrowed to whatever rows the current outcome/template filter
   *  leaves it with: `count`/`rows` reflect the FILTERED membership, so a template filter narrows
   *  an incident's own stated count rather than leaving it reporting the full unfiltered size
   *  (Task 6's own acceptance). `key` is this screen's own addition, the render identity below. */
  interface IncidentUnit extends EmailLogIncident {
    key: string;
  }
  type DisplayUnit = IncidentUnit | EmailLogSingleRow;

  /** A stable identity for an incident across re-renders: incidents carry no id of their own
   *  (they are a derived grouping, not a stored row), so the fold's own error/window fields
   *  double as one -- unique enough since two distinct incidents never share both. */
  function incidentKey(incident: EmailLogIncident): string {
    return `${incident.errorDetail}::${incident.firstSentAt}::${incident.lastSentAt}`;
  }

  /** The Segment column's known-key display labels: `segments.ts`'s own vocabulary (Task 1),
   *  duplicated here as a small literal map rather than imported, since that module resolves
   *  segments against the database and exports no static label table of its own. Any other raw
   *  key (`class:<id>`, `household:<id>`) falls back to the raw string; `null` (a test send with
   *  no segment) reads "Single". */
  const SEGMENT_LABELS: Record<string, string> = {
    current: 'Current households',
    lapsed: 'Former households',
    instructors: 'Instructors',
  };

  function segmentLabel(segment: string | null): string {
    return segment === null ? 'Single' : (SEGMENT_LABELS[segment] ?? segment);
  }

  type OutcomeFilter = 'all' | 'sent' | 'failed';
  let outcomeFilter = $state<OutcomeFilter>('all');
  let templateFilter = $state('all');
  let page = $state(1);
  const PAGE_SIZE = 25;

  let expandedIncidentKey = $state<string | null>(null);
  let incidentPage = $state(1);
  const INCIDENT_PAGE_SIZE = 50;

  function toggleIncident(key: string) {
    if (expandedIncidentKey === key) {
      expandedIncidentKey = null;
    } else {
      expandedIncidentKey = key;
      incidentPage = 1;
    }
  }

  const groupedUnits = $derived(groupEmailLog(data.log));

  const templateOptions = $derived(
    Array.from(new Set(data.log.map((row) => row.templateId).filter((id): id is string => id !== null))).sort(),
  );

  // The outcome filter selects among the grouped display units (failed shows incidents plus
  // failed singletons, sent shows sent rows only -- an incident is always a run of failed rows,
  // so it never survives a `sent` filter); the template filter narrows within a group.
  const filteredUnits = $derived.by(() => {
    const units: DisplayUnit[] = [];
    for (const unit of groupedUnits) {
      if (unit.kind === 'row') {
        if (outcomeFilter === 'sent' && unit.row.status !== 'sent') continue;
        if (outcomeFilter === 'failed' && unit.row.status !== 'failed') continue;
        if (templateFilter !== 'all' && unit.row.templateId !== templateFilter) continue;
        units.push(unit);
        continue;
      }
      if (outcomeFilter === 'sent') continue;
      const rows = templateFilter === 'all' ? unit.rows : unit.rows.filter((row) => row.templateId === templateFilter);
      if (rows.length === 0) continue;
      // `templateIds` is derived from the narrowed `rows`, not copied from the unfiltered
      // fold, so the summary line names exactly the templates the expanded state shows.
      const templateIds = Array.from(
        new Set(rows.map((row) => row.templateId).filter((id): id is string => id !== null)),
      ).sort();
      // The window narrows with the rows (item 10, the 2026-08-26 close round), the same
      // sort-and-take-the-ends `email-log-groups.ts`'s own `buildIncident` uses: without this, a
      // template-filtered incident kept stating the UNFILTERED chronology's own first/last send.
      const sentAts = rows.map((row) => row.sentAt).sort();
      units.push({
        ...unit,
        key: incidentKey(unit),
        count: rows.length,
        firstSentAt: sentAts[0],
        lastSentAt: sentAts[sentAts.length - 1],
        templateIds,
        rows,
      });
    }
    return units;
  });

  // The count line names real send attempts (an incident counts as its own filtered membership,
  // not as one unit), matching what an admin actually means by "N entries".
  const filteredEntryCount = $derived(
    filteredUnits.reduce((sum, unit) => sum + (unit.kind === 'incident' ? unit.count : 1), 0),
  );

  const appliedFilterLabels = $derived.by(() => {
    const labels: string[] = [];
    if (outcomeFilter !== 'all') labels.push(outcomeFilter === 'sent' ? 'Sent' : 'Failed');
    if (templateFilter !== 'all') labels.push(templateFilter);
    return labels;
  });

  // The filter band counts real send attempts, not display units (an incident's own filtered
  // membership, not itself as one row) -- "send"/"sends" names that (item 6, the 2026-08-26 close
  // round); the subtitle above keeps "log entry/entries" (the raw row count) and the pager below
  // counts "group/groups" (the folded display units it actually pages), so the screen's three
  // counts each name a different thing instead of two `role="status"` regions disagreeing.
  const countLine = $derived(computeCountLine(filteredEntryCount, { one: 'send', many: 'sends' }, appliedFilterLabels));

  const totalPages = $derived(Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE)));

  // A filter or view change can strand `page` past the new result count; rather than an `$effect`
  // resetting it back to 1 (which renders one empty frame before the reset commits), this derived
  // clamp is what slicing and `Pagination` actually read, so an out-of-range `page` never shows an
  // empty page even for the one frame between the filter change and a reset (item 11, the
  // 2026-08-26 close round). `incidentPage` needs no equivalent: it already resets to 1 in
  // `toggleIncident` whenever a new incident opens, the only place it can go stale.
  const safePage = $derived(Math.min(page, totalPages));
  const pageStart = $derived((safePage - 1) * PAGE_SIZE);
  const pagedUnits = $derived(filteredUnits.slice(pageStart, pageStart + PAGE_SIZE));

  function incidentWindowLabel(unit: IncidentUnit): string {
    return unit.firstSentAt === unit.lastSentAt
      ? formatClubTimestamp(unit.firstSentAt)
      : `${formatClubTimestamp(unit.firstSentAt)} – ${formatClubTimestamp(unit.lastSentAt)}`;
  }

  const subtitle = $derived(
    data.error ??
      (view === 'templates'
        ? `${data.templates.length} ${itemNoun(data.templates.length, { one: 'template', many: 'templates' })}.`
        : `${data.log.length} ${itemNoun(data.log.length, { one: 'log entry', many: 'log entries' })}.`),
  );
</script>

<OfficeList eyebrow="Club" title="Email" {subtitle}>
  {#snippet action()}
    <div class="email-view-actions">
      <div class="join" role="group" aria-label="Email view">
        {#each VIEW_TABS as tab (tab.id)}
          <button
            type="button"
            aria-pressed={view === tab.id}
            class="view-tab join-item btn btn-sm {view === tab.id ? 'btn-active' : ''}"
            onclick={() => (view = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
      <a href="/admin/club/email/compose" class="btn btn-primary btn-sm">Compose</a>
    </div>
  {/snippet}

  {#if data.error}
    <p class="border-b border-[var(--cairn-card-border)] px-6 py-3 type-body font-medium text-error" role="alert">
      {data.error}
    </p>
  {:else if view === 'templates'}
    {#if data.templates.length === 0}
      <EmptyState heading="No templates yet" message="Email templates are seeded in the club database; once one exists, it shows up here." />
    {:else}
      <div class="overflow-x-auto">
        <table class="table email-templates-table">
          <caption class="sr-only">Email templates, alphabetical by id</caption>
          <thead>
            <tr>
              <th class={HEADER_CELL}>Template</th>
              <th class={HEADER_CELL}>Subject</th>
              <th class="{HEADER_CELL} w-40">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {#each data.templates as template (template.id)}
              <tr class="email-template-row transition-colors hover:bg-base-200/60">
                <td>
                  <a class="font-semibold hover:text-primary hover:underline" href={`/admin/club/email/${template.id}`}>
                    {template.id}
                  </a>
                </td>
                <td class="type-body text-muted">{template.subject}</td>
                <td class="whitespace-nowrap type-body tabular-nums text-muted">{formatClubTimestamp(template.updatedAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else if data.log.length === 0}
    <EmptyState heading="No sends yet" message="Every attempted send, once real mail starts moving through Compose or an automated notice, shows up here." />
  {:else}
    <div class="email-filters border-b border-[var(--cairn-card-border)] p-6">
      <div class="email-filter-controls">
        <select class="select select-sm email-filter-select" aria-label="Outcome" bind:value={outcomeFilter}>
          <option value="all">All outcomes</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select class="select select-sm email-filter-select" aria-label="Template" bind:value={templateFilter}>
          <option value="all">All templates</option>
          {#each templateOptions as id (id)}
            <option value={id}>{id}</option>
          {/each}
        </select>
      </div>
      <p class="m-0 type-body text-muted" role="status" aria-live="polite" aria-atomic="true">{countLine}</p>
    </div>

    {#if pagedUnits.length === 0}
      <p class="px-6 py-10 text-center type-body text-muted">No entries match that filter.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="table email-log-table">
          <caption class="sr-only">Email send log, newest first</caption>
          <thead>
            <tr>
              <th class={HEADER_CELL}>Recipient</th>
              <th class={HEADER_CELL}>Template</th>
              <th class="{HEADER_CELL} w-24">Segment</th>
              <th class="{HEADER_CELL} w-28">Status</th>
              <th class="{HEADER_CELL} w-44">Sent</th>
            </tr>
          </thead>
          <tbody>
            {#each pagedUnits as unit (unit.kind === 'incident' ? unit.key : unit.row.id)}
              {#if unit.kind === 'incident'}
                {@const isOpen = expandedIncidentKey === unit.key}
                <tr class="email-incident-row">
                  <td colspan="5">
                    <div class="email-incident-line">
                      <span class="asc-admin-chip-warning">
                        <StatusChip tone="warning" register="quiet" label={`Failed × ${unit.count}`} size="xs" />
                      </span>
                      <span class="type-body font-medium">{unit.errorDetail}</span>
                      <span class="type-body text-muted">{incidentWindowLabel(unit)} &middot; {unit.templateIds.join(', ')}</span>
                      <span class="email-incident-toggle">
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs"
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Hide' : 'Show'} ${unit.count} sends for ${unit.errorDetail}`}
                          onclick={() => toggleIncident(unit.key)}
                        >
                          {isOpen ? 'Hide sends' : `Show ${unit.count} sends`}
                          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                        </button>
                      </span>
                    </div>
                  </td>
                </tr>
                {#if isOpen}
                  {@const incidentPageStart = (incidentPage - 1) * INCIDENT_PAGE_SIZE}
                  {@const incidentPageRows = unit.rows.slice(incidentPageStart, incidentPageStart + INCIDENT_PAGE_SIZE)}
                  {@const incidentTotalPages = Math.max(1, Math.ceil(unit.rows.length / INCIDENT_PAGE_SIZE))}
                  {#each incidentPageRows as row (row.id)}
                    <tr class="email-member-row">
                      <td class="type-body">{row.recipient}</td>
                      <td class="type-body text-muted">{row.templateId ?? '—'}</td>
                      <td class="type-body text-muted">{segmentLabel(row.segment)}</td>
                      <td>
                        <span class="asc-admin-chip-warning">
                          <StatusChip tone="warning" register="quiet" label="Failed" size="xs" />
                        </span>
                      </td>
                      <td class="whitespace-nowrap type-body tabular-nums text-muted">{formatClubTimestamp(row.sentAt)}</td>
                    </tr>
                  {/each}
                  <tr class="email-incident-pager">
                    <td colspan="5">
                      <div class="email-incident-pager-line">
                        <span class="type-body text-muted" role="status" aria-live="polite" aria-atomic="true">
                          {incidentPageStart + 1}&ndash;{Math.min(incidentPageStart + INCIDENT_PAGE_SIZE, unit.rows.length)} of {unit.rows.length} in this incident
                        </span>
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs {incidentPage === 1 ? 'btn-disabled' : ''}"
                          aria-disabled={incidentPage === 1}
                          onclick={() => {
                            if (incidentPage > 1) incidentPage -= 1;
                          }}
                        >
                          &lsaquo; Prev
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs {incidentPage === incidentTotalPages ? 'btn-disabled' : ''}"
                          aria-disabled={incidentPage === incidentTotalPages}
                          onclick={() => {
                            if (incidentPage < incidentTotalPages) incidentPage += 1;
                          }}
                        >
                          Next &rsaquo;
                        </button>
                      </div>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr>
                  <td class="type-body">{unit.row.recipient}</td>
                  <td class="type-body text-muted">{unit.row.templateId ?? '—'}</td>
                  <td class="type-body text-muted">{segmentLabel(unit.row.segment)}</td>
                  <td>
                    {#if unit.row.status === 'sent'}
                      <span class="asc-admin-chip-quiet">
                        <StatusChip tone="neutral" register="quiet" label="Sent" size="xs" />
                      </span>
                    {:else}
                      <span class="asc-admin-chip-warning">
                        <StatusChip tone="warning" register="quiet" label="Failed" size="xs" />
                      </span>
                    {/if}
                  </td>
                  <td class="whitespace-nowrap type-body tabular-nums text-muted">{formatClubTimestamp(unit.row.sentAt)}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div class="border-t border-[var(--cairn-card-border)] px-6 py-3">
      <Pagination
        page={safePage}
        pageCount={totalPages}
        onPageChange={(p) => (page = p)}
        totalItems={filteredUnits.length}
        pageSize={PAGE_SIZE}
        itemLabel={{ one: 'group', many: 'groups' }}
      />
    </div>
  {/if}
</OfficeList>

<style>
  /* `/admin/**` renders against the precompiled `cairn-admin.css`; every rule below is either
     plain CSS (a custom-property color, never scanned as a Tailwind utility) or a class already
     verified compiled elsewhere in this route family (assets/+page.svelte's own header explains
     the constraint this file inherits). */

  .email-view-actions {
    display: flex;
    align-items: center;
    gap: var(--cairn-gap-group);
  }

  /* The view switcher's selected segment, same fix `assets/+page.svelte` carries: `btn-active`
     mixes 7% black into `--color-base-200`, which reads in light (near-white) but nearly
     vanishes in `cairn-admin-dark` (already near-black). Mixing toward `--color-base-content`
     instead tracks the theme in both directions. */
  .view-tab[aria-pressed='true'] {
    --btn-bg: color-mix(in oklab, var(--color-base-content) 16%, var(--color-base-200));
    border-color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
  }

  .email-templates-table tbody tr:nth-child(even) {
    background-color: var(--color-base-200);
  }

  /* `:focus-within` counterpart to the row's own `hover:bg-base-200/60` utility (item 18, the
     2026-08-26 close round, the design-probe parity rule): a keyboard user tabbing to the row's
     link gets the same highlight a mouse hover gives. No Tailwind `focus-within:` variant of that
     exact utility compiles into the precompiled bundle, so this is the same formula that utility
     itself resolves to (verified against the built `cairn-admin.css`), applied as plain CSS. */
  .email-template-row:focus-within {
    background-color: color-mix(in oklab, var(--color-base-200) 60%, transparent);
  }

  .email-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--cairn-gap-group);
  }

  .email-filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cairn-gap-control);
  }

  /* The daisyUI `.select` base sizes to `clamp(3rem, 20rem, 100%)`: inside this row's own flex
     layout, alongside the count line's own flexible width, that clamp let each select claim up to
     20rem and forced the pair into a column at 1440 (item 1, the 2026-08-26 close round, the
     coherence read's loudest tell -- measured at 234px). Sized to content instead, so both selects
     sit in one row at any width their own option text allows. */
  .email-filter-select {
    width: auto;
    flex: 0 1 auto;
  }

  /* Ordinary send-log rows stripe on the standard even/odd rhythm; incident, member, and
     in-incident-pager rows opt out and carry their own ground below (probe verdict 1: the
     incident row itself stays on the plain, unstriped ground -- only its own warning chip
     carries the tone). */
  .email-log-table tbody tr:not(.email-incident-row):not(.email-member-row):not(.email-incident-pager):nth-child(even) {
    background-color: var(--color-base-200);
  }

  .email-incident-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
    padding-block: 0.15rem;
  }

  /* `position: sticky` pins the toggle to the right edge of the `.overflow-x-auto` scroll
     container (its own nearest scrolling ancestor), so it stays reachable at 390 without side-
     scrolling past the incident row's other text (item 8, the 2026-08-26 close round); the plain
     ground keeps rows scrolling under it opaque rather than letting them show through. */
  .email-incident-toggle {
    margin-left: auto;
    position: sticky;
    right: 0;
    background-color: var(--color-base-100);
  }

  /* Inset member rows (probe verdict 2): a quiet, non-alternating tint distinct from the
     ordinary zebra stripe, with the first cell indented so the group reads as nested under its
     own incident row. */
  .email-member-row {
    background-color: color-mix(in oklab, var(--color-base-200) 35%, transparent);
  }

  .email-member-row td:first-child {
    padding-left: 2.75rem;
  }

  .email-incident-pager td {
    padding: 0;
    border-bottom: 0;
  }

  .email-incident-pager-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 1rem 0.4rem 2.75rem;
    border-bottom: 1px solid var(--cairn-card-border);
  }
</style>
