-- asc-club migration 0019: what the enrollee wants to learn.
--
-- Class registration grows an optional free-text question ("Anything specific you'd like to
-- learn?", Geoff's 2026-07-13 ask): the answers let the Program Committee shape an event like
-- Skills & Drills Weekend around member interest. An enrollment stores the answer here; a
-- waitlisted signup carries it in class_waitlist.notes, which already exists for exactly this
-- kind of applicant-supplied context. NULL means the question was left blank.
ALTER TABLE class_enrollments ADD COLUMN interests TEXT;
