// The portal's own profile update (design doc's "4. Profile"): the lean fields only (email,
// phone, birthdate), matching 0005_member_domain's own `members` columns. Validation lives here
// (a plain typed-result function, this codebase's own convention: `class-form-input.ts`'s own
// header), never thrown; the route's own action turns a refusal into a form error.
import type { D1Database } from '@cloudflare/workers-types';

/** A user-facing refusal, matching `offers.ts`/`enrollments.ts`'s own `{ error }` shape so every
 *  portal write path answers refusals the same way. */
export interface ProfileActionError {
  error: string;
}

/** E.164: a leading `+`, then 8-15 digits total (the ITU's own length bound), no other
 *  characters — the schema's own `phone` column comment ("E.164 stored, formatted on render",
 *  design doc's own "4. Profile"). */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Validate a phone number is E.164-shaped, or refuse with a plain-words reason. An empty string
 *  is valid (the field is optional, matching `members.phone`'s own nullability). */
export function validatePhone(phone: string): { ok: true; value: string | null } | ProfileActionError {
  const trimmed = phone.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!E164_PATTERN.test(trimmed)) {
    return { error: 'Enter a phone number with a country code, like +19075551234.' };
  }
  return { ok: true, value: trimmed };
}

/** A plain, permissive email shape check (this codebase's own bar, matching the public
 *  class-signup form's own bare `type="email"` input — no stricter check anywhere else in this
 *  domain). An empty string is valid: a covered dependent may have no email on file (0005's own
 *  schema comment). */
function validateEmail(email: string): { ok: true; value: string | null } | ProfileActionError {
  const trimmed = email.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
    return { error: 'Enter a valid email address.' };
  }
  return { ok: true, value: trimmed };
}

/** A civil-date shape check (YYYY-MM-DD) for birthdate; empty clears it (the field is optional
 *  and never rendered to other members, design doc's own "4. Profile"). */
function validateBirthdate(birthdate: string): { ok: true; value: string | null } | ProfileActionError {
  const trimmed = birthdate.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(new Date(`${trimmed}T00:00:00Z`).getTime())) {
    return { error: 'Enter a valid date.' };
  }
  return { ok: true, value: trimmed };
}

export interface ProfileUpdateInput {
  email: string;
  phone: string;
  birthdate: string;
}

/**
 * Update a member's own lean profile fields, validating each before writing any of them (a
 * partial write on a bad field would leave the row inconsistent with what the form showed).
 * `email` uniqueness (`members.email UNIQUE`) is not pre-checked here: a collision surfaces as a
 * `UNIQUE constraint failed` from the `UPDATE` itself, caught and turned into the one relevant
 * refusal, the same substring-match convention `enrollments.ts`'s `isUniqueViolation` uses.
 */
export async function updateProfile(db: D1Database, memberId: string, input: ProfileUpdateInput): Promise<{ ok: true } | ProfileActionError> {
  const email = validateEmail(input.email);
  if ('error' in email) return email;
  const phone = validatePhone(input.phone);
  if ('error' in phone) return phone;
  const birthdate = validateBirthdate(input.birthdate);
  if ('error' in birthdate) return birthdate;

  try {
    await db
      .prepare("UPDATE members SET email = ?1, phone = ?2, birthdate = ?3, updated_at = datetime('now') WHERE id = ?4")
      .bind(email.value, phone.value, birthdate.value, memberId)
      .run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE') && err.message.includes('members')) {
      return { error: 'That email address is already on file for another member.' };
    }
    console.error('member-portal: profile update failed', err);
    return { error: 'Something went wrong saving your profile. Please try again.' };
  }
  return { ok: true };
}
