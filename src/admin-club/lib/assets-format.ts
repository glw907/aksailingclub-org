// Display-time formatting for `asset_assignments.description`, the free-text field
// `scripts/import/ops-assets.mjs` carried over from the legacy ops stack largely in shouting
// case ("TRAILER", "BAT BOAT"). Kept out of `assets-store.ts` (data access only, per that
// module's own header) and out of `member-format.ts` (that file's chip vocabulary is
// member-domain specific; this helper is asset-domain and consumed by the Assets and
// asset-requests screens too, not just the household desk).

/**
 * Recase one description for display, never for storage: the stored value never changes,
 * only what a screen renders.
 *
 * Splits on whitespace and title-cases only the tokens the contract's ruling 3 calls
 * conservative: entirely uppercase alphabetic and 3 or more characters ("TRAILER" becomes
 * "Trailer", "BAT" inside "BAT BOAT" becomes "Bat"). Every other token passes through
 * byte-identical: a 1-2 character all-caps token such as "II" (too short to safely assume a
 * shouted word rather than an abbreviation), any token carrying a digit or punctuation such
 * as "2", and any token that already mixes case. `null` and empty strings pass through
 * unchanged.
 */
export function displayDescription(raw: string | null): string | null {
  if (raw === null || raw === '') return raw;
  return raw.replace(/\S+/g, (token) => {
    if (!/^[A-Z]+$/.test(token) || token.length < 3) return token;
    return token[0] + token.slice(1).toLowerCase();
  });
}
