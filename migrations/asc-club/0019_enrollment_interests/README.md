# 0019_enrollment_interests

Adds `class_enrollments.interests` (TEXT, nullable): the enrollee's optional answer to the
signup form's "Anything specific you'd like to learn?" question, so the Program Committee can
shape an event like Skills & Drills Weekend around member interest. A waitlisted signup
carries the same answer in `class_waitlist.notes`, which already exists for applicant-supplied
context, so no waitlist change is needed. NULL means the question was left blank.

Applied with the standard pattern (scratch-proven, then
`npx wrangler d1 execute asc-club --remote --file .../forward.sql`, then `verify.sql`).
