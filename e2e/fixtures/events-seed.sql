-- Fixture data for the site-visual e2e suite's local D1 (never the real asc-ops the ops stack
-- owns; wrangler d1 execute --local writes only to the gitignored .wrangler/state replica the
-- CI runner starts empty). The real EVENTS_DB binding is read-only ops data this site never seeds
-- or writes in production; this table shape mirrors the read-only schema season-data.ts documents
-- (asc-ops's `events` and `classes` tables), with one row per C7-gold taxonomy category so the
-- Season section and /events render every visual case (a regatta in plain ink, a class with the
-- gold dot, and a muted routine entry, one of them in the off-season bucket) instead of the empty
-- section a truly-empty local D1 would show.
--
-- Fixed dates, not "whenever CI runs": season-data.ts groups by the real calendar year at request
-- time, so this fixture must be refreshed to the current year whenever the site-visual baselines
-- are regenerated (the same annual upkeep any date-bearing fixture in this family needs).
-- DROP first so a developer can re-run the suite against an already-seeded local D1 without a
-- "table already exists" failure; CI always starts from the gitignored .wrangler/state fresh, so
-- the drop is a no-op there.
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS classes;

CREATE TABLE events (
  title TEXT NOT NULL,
  slug TEXT,
  event_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  date_history TEXT,
  visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE classes (
  name TEXT NOT NULL,
  slug TEXT,
  registration_status TEXT,
  start_date TEXT,
  end_date TEXT,
  date_history TEXT,
  visible INTEGER NOT NULL DEFAULT 1
);

INSERT INTO events (title, slug, event_type, start_date, end_date, visible) VALUES
  ('Test Spring Work Party', 'test-spring-work-party', 'work_party', '2026-05-18', '2026-05-18', 1),
  ('Test Regatta', 'test-regatta', 'regatta', '2026-07-10', '2026-07-11', 1),
  ('Test Off-Season Social', 'test-off-season-social', 'social', '2026-11-05', '2026-11-05', 1);

INSERT INTO classes (name, slug, registration_status, start_date, end_date, visible) VALUES
  ('Test Intro Class', 'test-intro-class', 'open', '2026-06-20', '2026-06-22', 1);
