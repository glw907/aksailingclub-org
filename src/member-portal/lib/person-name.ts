// Tiny, shared name-formatting helpers (member-waivers T5b): the household-complete loop's own
// copy names people in running sentences ("Blair's are needed before payment") in more than one
// place -- the signing page (`sign-view.ts`, which re-exports these) and the portal landing's own
// waiver rows (`waiver-action-rows.ts`) -- so the split lives here rather than in either one's own
// module (a route's own module is never a library import target elsewhere in this codebase).
/** The first whitespace-delimited token of a full name. Falls back to the full (trimmed) name for
 *  a single-token name. Matches this repo's own "no name-parsing library" posture elsewhere
 *  (`member-normalize.js`'s own recasing stays whole-name). */
export function firstNameOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** A natural-language join ("Blair", "Blair and Casey", "Blair, Casey, and Devon"): a real
 *  household is, in practice, one or two people, so no Oxford-comma library earns its keep here. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
