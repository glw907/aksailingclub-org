-- asc-club migration 0027: the directory domain (boats, committees, member positions) plus a
-- household address, for the member-directory pass
-- (docs/plans/2026-07-17-member-directory.md's T1, executing
-- docs/2026-07-17-roles-committees-design.md and docs/2026-07-17-member-directory-design.md's
-- "Revisions" block). One atomic migration bundling the whole domain, the same shape
-- 0005_member_domain used for the member core.
--
-- `boats` attaches to a MEMBER (`member_id`, the owner), not a household -- the roles spec's
-- own supersession of the directory spec's original decision 4, so a family with several boats
-- can say who owns which. `name` is nullable in the schema only to admit nameless legacy seed
-- rows (T2's importer); every capture path going forward requires it. `class` is a fixed,
-- non-editable picker; `model` is required exactly when `class = 'Other'`, held free text for
-- everything the picker does not name, and forbidden otherwise -- the table-level CHECK below
-- enforces both directions so a row can never drift into "Other with no model" or "Buccaneer 18
-- with a stray model".
--
-- `committees`, `committee_members`, and `member_positions` land the roles spec's ratified model:
-- committee membership is request-then-approve (`status` starts `'pending'`; a chair or board
-- member promotes it to `'active'`), a member's committee role is `'chair'`, `'co-chair'`, or
-- plain `'member'`, and a member's board-level authority comes from `member_positions.kind`
-- (`'officer'` | `'director'` | `'appointed'`), never a title-string match -- authorization reads
-- `kind`, `title` is display text only. Chair titles ("Fleet Committee Chair") are never stored:
-- they derive at render from `committee_members.role` joined to `committees.name` (T3). No seed
-- rows land here; T2 (boats) and T2b (committees + people) seed separately, after Geoff's review
-- of their own dry-run plans.
--
-- The household ADDRESS columns are additive to the existing `households` table (`city` already
-- exists, `0005_member_domain`); no new visibility switch, per the directory spec's decision 7 --
-- the address rides the existing `directory_visibility` dial at the visible tier (T3/T5).

ALTER TABLE households ADD COLUMN address_line1 TEXT;
ALTER TABLE households ADD COLUMN address_line2 TEXT;
ALTER TABLE households ADD COLUMN state TEXT;
ALTER TABLE households ADD COLUMN postal_code TEXT;

CREATE TABLE boats (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  name TEXT,                       -- nullable for legacy seed rows only; required at capture
  class TEXT NOT NULL CHECK (class IN ('Buccaneer 18','Laser','Other')),
  model TEXT,                      -- required iff class = 'Other'; see the table CHECK below
  sail_number TEXT,
  kept_on TEXT NOT NULL DEFAULT 'trailer' CHECK (kept_on IN ('trailer','mooring')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (class = 'Other' AND model IS NOT NULL) OR
    (class <> 'Other' AND model IS NULL)
  )
);
CREATE INDEX idx_boats_member ON boats(member_id);

CREATE TABLE committees (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('standing','established')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,                -- set = archived; keeps roster history, drops off member surfaces
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE committee_members (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('chair','co-chair','member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (committee_id, member_id)
);
CREATE INDEX idx_committee_members_committee ON committee_members(committee_id);
CREATE INDEX idx_committee_members_member ON committee_members(member_id);

CREATE TABLE member_positions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK (kind IN ('officer','director','appointed')),
  title TEXT NOT NULL,             -- display text; authorization reads `kind`, never this
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_member_positions_member ON member_positions(member_id);
