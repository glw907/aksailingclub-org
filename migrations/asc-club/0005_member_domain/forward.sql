-- asc-club migration 0005: the member domain (pass 2.2's own tables, landed early to unblock
-- pass 2.1's write paths).
--
-- The finding that forces this migration ahead of its own pass: real (remote) D1 enforces that a
-- `REFERENCES` target TABLE exists at write time, refusing an insert outright with
-- `no such table: main.members` when it does not (see `0004_waitlist_integrity/README.md`'s own
-- "Adjacent finding"). `class_waitlist`, `class_enrollments`, and `class_instructors` (all
-- 0001_substrate) declare `REFERENCES members(id)` columns that have had no target table until
-- now, so every write through those columns has been failing against the real database, working
-- only against the `fakeD1` test double. This migration lands the ratified member-domain DDL
-- (cairn-cms/docs/superpowers/specs/assets/phase-2-reference/asc-club-schema.sql, the "THE MEMBER
-- CORE (pass 2.2)" section) verbatim in table structure, no seed rows, so those write paths have
-- a real target to reference. Full pass-2.2 behavior (the join flow, the portal, the credit
-- ledger's redemption UI) is still a later pass; this migration only lands the structure.
--
-- `households.primary_member_id` and `members.household_id` reference each other (a household
-- has exactly one primary member; a member belongs to exactly one household): SQLite does not
-- require a REFERENCES target to exist at CREATE TABLE time (0001_substrate's own header), so
-- `households` can be created first, same order the ratified DDL itself uses. A household row is
-- always written with `primary_member_id` initially NULL, then set once its first member's id is
-- known, in the same `db.batch()` (`src/admin-club/lib/people.ts`'s `ensureMember`, this pass's
-- own Part 2): the deferred-primary dance the ratified DDL's own comment names.
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,              -- "the Larsens": the volunteer's name for it
  city TEXT,
  primary_member_id TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE,               -- nullable: a covered child may have none
  phone TEXT,
  birthdate TEXT,                  -- civil date; age gates (8-12, 13+, 18-25) compute
                                   -- from it; NEVER rendered in the directory
  directory_visibility TEXT NOT NULL DEFAULT 'partial'
    CHECK (directory_visibility IN ('visible','partial','hidden')),
  archived_at TEXT,                -- set = "not coming back"; excluded from lists,
                                   -- directory, and segments; history intact
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_members_household ON members(household_id);

-- A MEMBERSHIP is the household's per-season purchase: two entities, canon. Standing
-- (current/lapsed) DERIVES: a household is current for a season iff a paid membership
-- row exists for it; no mutable status flag to rot. Rollover CREATES next season's
-- rows; it never wipes (the anti-ops rule).
CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  season INTEGER NOT NULL,         -- the year
  tier TEXT NOT NULL CHECK (tier IN ('individual','family','young-adult')),
  price_paid INTEGER NOT NULL,     -- SNAPSHOT at purchase; tier prices are settings
  paid_at TEXT,                    -- NULL = invoiced/pending; membership ACTIVATES on
                                   -- payment (board review is post-hoc, never a gate)
  stripe_ref TEXT,                 -- payment link / checkout session id
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, season)    -- one membership per household per season
);
CREATE INDEX idx_memberships_season ON memberships(season);

-- The credit LEDGER: grants minus redemptions, computed, never stored. NO season column
-- ANYWHERE here: "credits never expire, even if your membership lapses" is the published
-- promise, held structurally.
CREATE TABLE credit_grants (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  membership_id TEXT NOT NULL REFERENCES memberships(id),  -- the joining purchase
  credits INTEGER NOT NULL,        -- 2 family / 1 individual / 1 young-adult
  granted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE credit_redemptions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  enrollment_id TEXT NOT NULL REFERENCES class_enrollments(id),
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  redeemed_by TEXT NOT NULL        -- member id or admin email; audited either way
);
