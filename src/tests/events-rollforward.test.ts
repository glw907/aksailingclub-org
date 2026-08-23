// The season roll-forward and the ledger's own ordering (events-admin pass, Task 2). Split from
// events-store.test.ts because this file's own fixtures are inherently multi-row/multi-season,
// unlike that file's single-row read/write assertions. Like every store test in this repo,
// `fakeD1` executes no SQL: these tests assert the SQL text and the bound arguments (or, for
// `listLedger`, canned rows shaped as the real join would return them), never a live engine.
import { describe, expect, it } from 'vitest';
import { fakeD1 } from './_fake-d1';
import { listLedger, previewRollForward, rollForwardSeason } from '$admin-club/lib/events-store';

describe('previewRollForward', () => {
  it('sorts into create/skipped with the retired -> once -> already-rolled -> slug-taken precedence, both lists title-sorted', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM event_series es': [
          { series_id: 'series-a', title: 'A Annual New', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
          { series_id: 'series-b', title: 'B Retired', recurrence: 'annual', retired_at: '2026-01-01 00:00:00', has_to_season: 0, slug_taken: 0 },
          { series_id: 'series-c', title: 'C Once', recurrence: 'once', retired_at: null, has_to_season: 0, slug_taken: 0 },
          { series_id: 'series-d', title: 'D Already Rolled', recurrence: 'annual', retired_at: null, has_to_season: 1, slug_taken: 0 },
          // Both retired AND once-off: retired wins (the stated precedence).
          { series_id: 'series-e', title: 'E Retired And Once', recurrence: 'once', retired_at: '2026-01-01 00:00:00', has_to_season: 0, slug_taken: 0 },
          // A different series already holds this series' slug in toSeason: skipped, never a
          // silent no-op the officer discovers only after the roll-forward.
          { series_id: 'series-f', title: 'F Slug Taken', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 1 },
        ],
      },
    });

    const plan = await previewRollForward(db, { fromSeason: 2026, toSeason: 2027 });

    expect(plan).toEqual({
      fromSeason: 2026,
      toSeason: 2027,
      create: [{ seriesId: 'series-a', title: 'A Annual New' }],
      skipped: [
        { seriesId: 'series-b', title: 'B Retired', reason: 'retired' },
        { seriesId: 'series-c', title: 'C Once', reason: 'once' },
        { seriesId: 'series-d', title: 'D Already Rolled', reason: 'already-rolled' },
        { seriesId: 'series-e', title: 'E Retired And Once', reason: 'retired' },
        { seriesId: 'series-f', title: 'F Slug Taken', reason: 'slug-taken' },
      ],
    });
    expect(calls[0].args).toEqual([2026, 2027]);
  });
});

describe('rollForwardSeason', () => {
  it('inserts one row per create entry as a single INSERT ... SELECT (no per-row JS read of the source), copying everything but the dates/times, undated and hidden', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM event_series es': [
          { series_id: 'series-a', title: 'Regatta', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
        ],
      },
    });

    const result = await rollForwardSeason(db, { fromSeason: 2026, toSeason: 2027 });
    expect(result).toEqual({ created: 1, skipped: 0 });

    const insertCall = calls.find((c) => c.sql.startsWith('INSERT INTO events'));
    expect(insertCall).toBeDefined();
    expect(insertCall!.sql).toContain('FROM events src');
    expect(insertCall!.sql).toContain("src.slug || '-' || ?2");
    expect(insertCall!.sql).toContain('NULL, NULL, NULL, NULL');
    expect(insertCall!.sql).toContain('NOT EXISTS (SELECT 1 FROM events WHERE series_id = ?1 AND season = ?2)');
    expect(insertCall!.sql).toContain('NOT EXISTS (SELECT 1 FROM events WHERE slug = src.slug AND season = ?2)');
    expect(insertCall!.sql).toContain("NOT EXISTS (SELECT 1 FROM events WHERE id = src.slug || '-' || ?2)");
    expect(insertCall!.args).toEqual(['series-a', 2027, 2026]);
  });

  it("counts each statement's own meta.changes, not the number of statements queued: a guard that skips a row does not inflate the count", async () => {
    const { db } = fakeD1({
      allResults: {
        'FROM event_series es': [
          { series_id: 'series-a', title: 'Regatta', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
          { series_id: 'series-b', title: 'Clinic', recurrence: 'annual', retired_at: null, has_to_season: 0, slug_taken: 0 },
        ],
      },
      // series-b's own INSERT loses the race against its own NOT EXISTS guard (a row landed
      // between previewRollForward's read and this batch), so it reports zero changes even
      // though the statement itself ran and succeeded.
      runResults: {
        'INSERT INTO events': (args: unknown[]) => (args[0] === 'series-a' ? { changes: 1 } : { changes: 0 }),
      },
    });

    const result = await rollForwardSeason(db, { fromSeason: 2026, toSeason: 2027 });
    expect(result).toEqual({ created: 1, skipped: 0 });
  });

  it('is idempotent: a second run against a fixture reporting the rolled row creates nothing', async () => {
    let reads = 0;
    const { db, calls } = fakeD1({
      allResults: {
        'FROM event_series es': () => {
          reads += 1;
          return [
            {
              series_id: 'series-a',
              title: 'Regatta',
              recurrence: 'annual',
              retired_at: null,
              // The first read shows the series not yet rolled; the second read (simulating the
              // row the first call just inserted) shows it already in toSeason.
              has_to_season: reads > 1 ? 1 : 0,
              slug_taken: 0,
            },
          ];
        },
      },
    });

    const first = await rollForwardSeason(db, { fromSeason: 2026, toSeason: 2027 });
    expect(first).toEqual({ created: 1, skipped: 0 });

    const second = await rollForwardSeason(db, { fromSeason: 2026, toSeason: 2027 });
    expect(second).toEqual({ created: 0, skipped: 1 });

    expect(calls.filter((c) => c.sql.startsWith('INSERT INTO events')).length).toBe(1);
  });

  it('creates nothing and returns skipped counts when the plan has nothing to create', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM event_series es': [
          {
            series_id: 'series-b',
            title: 'Retired Regatta',
            recurrence: 'annual',
            retired_at: '2026-01-01 00:00:00',
            has_to_season: 0,
            slug_taken: 0,
          },
        ],
      },
    });
    await expect(rollForwardSeason(db, { fromSeason: 2026, toSeason: 2027 })).resolves.toEqual({ created: 0, skipped: 1 });
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO events'))).toBe(false);
  });
});

describe('listLedger', () => {
  const baseRaw = {
    category: 'racing' as const,
    short_description: null,
    long_description: null,
    start_time: null,
    end_date: null,
    end_time: null,
    location: null,
    hero_image: null,
    hero_image_alt: null,
    thumbnail_image: null,
    visible: 1 as const,
    created_at: '2027-01-01 00:00:00',
    updated_at: '2027-01-01 00:00:00',
    recurrence: 'annual',
    retired_at: null as string | null,
  };

  const EVENT_ROWS = [
    // Commodore's Cup: dated this season (2027).
    {
      ...baseRaw,
      id: 'commodores-2027',
      series_id: 'series-commodores',
      season: 2027,
      title: "Commodore's Cup",
      slug: 'commodores-cup',
      start_date: '2027-07-18',
      series_title: "Commodore's Cup",
    },
    // Governor's Cup: undated this season, but dated last season -- keeps last year's calendar
    // position.
    {
      ...baseRaw,
      id: 'governors-2027',
      series_id: 'series-governors',
      season: 2027,
      title: "Governor's Cup",
      slug: 'governors-cup',
      start_date: null,
      visible: 0 as const,
      series_title: "Governor's Cup",
    },
    {
      ...baseRaw,
      id: 'governors-2026',
      series_id: 'series-governors',
      season: 2026,
      title: "Governor's Cup",
      slug: 'governors-cup',
      start_date: '2026-06-01',
      series_title: "Governor's Cup",
    },
    // Winter Meeting: dated nowhere in the three-season window -- sorts last.
    {
      ...baseRaw,
      id: 'winter-2027',
      series_id: 'series-winter',
      season: 2027,
      title: 'Winter Meeting',
      slug: 'winter-meeting',
      start_date: null,
      visible: 0 as const,
      series_title: 'Winter Meeting',
    },
  ];

  const CLASS_ROWS = [
    // Tied with Commodore's Cup on the same MM-DD (07-18), a lowercase-initial title against
    // Commodore's Cup's uppercase-initial one: a raw, un-lowered string compare would sort
    // "Commodore's Cup" first (`'C'` sorts below `'a'` in char-code order), the opposite of the
    // alphabetical order this row must actually land in.
    {
      id: 'arctic-swim-meet-2027',
      season: 2027,
      name: 'arctic swim meet',
      slug: 'arctic-swim-meet',
      start_date: '2027-07-18',
      end_date: null,
      visible: 1 as const,
    },
  ];

  it('issues at most three statements and orders rows by month-and-day, nulls last, ties broken by case-insensitive title', async () => {
    const { db, calls } = fakeD1({
      allResults: {
        'FROM events e JOIN event_series s': EVENT_ROWS,
        'FROM classes WHERE season IN': CLASS_ROWS,
      },
    });

    const rows = await listLedger(db, 2027);

    expect(rows.map((row) => row.title)).toEqual(["Governor's Cup", 'arctic swim meet', "Commodore's Cup", 'Winter Meeting']);
    expect(rows.map((row) => row.kind)).toEqual(['event', 'class', 'event', 'event']);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it('keeps a series in the ledger with current: null when it holds no row at all this season', async () => {
    // Distinct from Governor's Cup above (which HAS a 2027 row, just an undated one): this
    // series ran in 2026 and is entirely absent from 2027, so it must still surface for its
    // history to stay visible.
    const lighthouseCruise = {
      ...baseRaw,
      id: 'lighthouse-2026',
      series_id: 'series-lighthouse',
      season: 2026,
      title: 'Lighthouse Cruise',
      slug: 'lighthouse-cruise',
      start_date: '2026-09-12',
      series_title: 'Lighthouse Cruise',
    };
    const { db } = fakeD1({
      allResults: { 'FROM events e JOIN event_series s': [...EVENT_ROWS, lighthouseCruise], 'FROM classes WHERE season IN': [] },
    });
    const rows = await listLedger(db, 2027);
    const lighthouse = rows.find((row) => row.title === 'Lighthouse Cruise');
    expect(lighthouse?.current).toBeNull();
    expect(lighthouse?.prior[0]).toEqual(expect.objectContaining({ id: 'lighthouse-2026', startDate: '2026-09-12' }));
  });
});
