// Pure view logic for the signing moment (member-waivers T4, the RATIFIED probe design in
// docs/design-benchmark/waivers-signing-round-1-arc.md): the derivations the one continuous
// signing moment needs -- entry ordering, the receipt/current/upcoming state each entry sits in,
// the "type once, sign each" prefill carry-forward, the AS 09.65.292 attestation carry-forward,
// the welcome line, and the time estimate -- kept out of the component so each rule is unit tested
// on its own (directory-view.ts's own pattern). Nothing here touches the DOM, the network, or a
// database; the route (+page.server.ts) assembles the item list from the T3 requirement engine and
// a signature query, hands it here, and renders the result.
//
// All member-facing strings are VERBATIM from docs/waivers/signing-framing-copy.md (the framing
// copy the Fable sitting drafted and an independent critic reviewed): a framing line names a
// document and points into its text, and never characterizes its legal effect. The straight
// apostrophes match that file byte-for-byte, deliberately -- the attorney reviews these lines
// beside the documents, so they are reproduced exactly as written, not re-typeset.
import type { DocumentKind } from '$theme/documents';
import type { HouseholdRequirements } from '$member-portal/lib/waiver-requirements';
import { householdSignatureGate } from '$member-portal/lib/household-signature-gate';
import { firstNameOf, joinNames } from '$member-portal/lib/person-name';

export { firstNameOf, joinNames };

/** One signable act in the moment, before state is assigned. `kind` separates the signer's own
 *  documents from a per-child Part Two election under a release; `bodyHtml` is the rendered
 *  document body the sheet displays (the route renders it through the cairn pipeline). */
export interface SigningItem {
  /** A stable, unique key across the whole moment (the route builds it from document id plus, for
   *  a minor entry, the minor's member id). */
  key: string;
  kind: 'personal' | 'minor';
  documentId: string;
  version: number;
  documentKind: DocumentKind;
  /** The entry heading: the document's own title (the sheet omits it, the heading carries it). */
  title: string;
  /** The rendered document body for the sheet. Optional so a pure ordering/state test need not
   *  supply markup. */
  bodyHtml?: string;
  /** Present on a `minor` item: the child this Part Two is signed for. */
  minor?: { memberId: string; name: string; birthYear: number | null };
  /** The existing signature for this item, if it is already on file. Carries the fields the view
   *  needs that the T3 engine's own minimal record does not: the name as typed (for the receipt
   *  and the prefill), the attested relationship (for the carry-forward), and the timestamp. */
  signature?: { personName: string; signerRelationship: string | null; signedAt: string };
}

/** The document-kind order the moment presents in: the release first (it is the spine of the
 *  moment and every minor Part Two hangs off it), then acknowledgements, then agreements. */
const DOCUMENT_KIND_RANK: Record<DocumentKind, number> = { release: 0, acknowledgement: 1, agreement: 2 };

/** The per-document framing line, keyed by document business id (`DocumentFrontmatter.document`).
 *  Verbatim from signing-framing-copy.md. A `minor` entry uses {@link minorFramingLine} instead,
 *  since that line names the child. */
const FRAMING_LINES: Record<string, string> = {
  'general-release':
    "This is the club's liability release. Read it in full before you sign: your signature means you accepted exactly this text.",
  'rules-acknowledgement':
    "These are the rules every member agrees to live by. Your signature is the club's record that you've read the current season's version.",
  'mooring-agreement': 'This is the agreement that comes with your mooring. Read it in full before you sign.',
  'storage-agreement': 'This is the agreement that comes with your storage space. Read it in full before you sign.',
  'rv-acknowledgement': 'These are the rules for your Trailer Row space this season.',
  'boat-parking-acknowledgement': 'These are the rules for your boat-parking space this season.',
  'rack-acknowledgement': 'These are the rules for your rack space this season.',
};

/** The Part Two framing line, naming the child (signing-framing-copy.md, "Release of
 *  Liability—Part Two, signed per child"). */
export function minorFramingLine(childName: string): string {
  return `You're signing this part for ${childName}, as their parent or guardian. Read it in full before you sign.`;
}

/** The framing line for a personal document, or a plain fallback for any document the copy does not
 *  name (never expected for a v1 document, but the moment must still render one rather than a
 *  blank). */
export function framingLine(documentId: string): string {
  return FRAMING_LINES[documentId] ?? 'Read this document in full before you sign.';
}

/** The AS 09.65.292(c) relationship attestation prompt shown above the radios in a minor entry's
 *  signature strip (the exact lead-in from the general release's "Who may sign" section). */
export const MINOR_ATTESTATION_PROMPT = 'I attest that I am, for this child (Alaska Statute 09.65.292(c)):';

/** The estimated minutes for the welcome line: `max(2, 2 x N)` (signing-framing-copy.md). */
export function timeEstimateMinutes(documentCount: number): number {
  return Math.max(2, 2 * documentCount);
}

/** The welcome line at the top of the moment. The single-document case has its own copy (a
 *  "couple of minutes", no count); the multi-document case names the count and the estimate. Both
 *  strings are verbatim from signing-framing-copy.md, em dashes and all (member-facing content
 *  register, where the em dash is allowed). */
export interface WelcomeLine {
  heading: string;
  body: string;
}
export function buildWelcome(season: number, documentCount: number): WelcomeLine {
  if (documentCount === 1) {
    return {
      heading: `A signature for the ${season} season.`,
      body: "One document needs your signature. It's shown in full below—plan on a couple of minutes to read and sign.",
    };
  }
  const minutes = timeEstimateMinutes(documentCount);
  return {
    heading: `Signatures for the ${season} season.`,
    body: `${documentCount} documents need your signature. Each one is shown in full—plan on about ${minutes} minutes to read and sign.`,
  };
}

/** Format a signature's stored timestamp (a SQLite `YYYY-MM-DD HH:MM:SS` string, or an ISO one)
 *  as a friendly "14 May 2026" for the receipt line. Reads only the date part, so the local clock
 *  never shifts the day. Falls back to the raw value if it does not parse. */
export function formatSignedDate(signedAt: string): string {
  const datePart = signedAt.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return signedAt;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [, year, month, day] = match;
  const monthName = months[Number(month) - 1];
  if (!monthName) return signedAt;
  return `${Number(day)} ${monthName} ${year}`;
}

/** One entry in the built moment: a {@link SigningItem} with its state and every derived label the
 *  component renders. */
export interface SigningEntry {
  key: string;
  kind: 'personal' | 'minor';
  documentId: string;
  version: number;
  documentKind: DocumentKind;
  title: string;
  bodyHtml: string;
  minor?: { memberId: string; name: string; birthYear: number | null };
  framingLine: string;
  state: 'signed' | 'current' | 'upcoming';
  /** "Signed {date} as {name}." on a `signed` entry, else `null` (signing-framing-copy.md). */
  receiptText: string | null;
  /** "Document {i} of {N}" on the `current` entry, else `null`. `i` counts every entry in the
   *  moment, `N` is the total, so progress reads against the whole moment, not the outstanding
   *  remainder. */
  progressLabel: string | null;
  /** The name to prefill the `current` entry's typed-name field with ("type once, sign each"):
   *  empty on the first signature of the moment (typed fresh), then the name used on the most
   *  recent signature. Editable in the field regardless. */
  prefillName: string;
  /** The relationship to preselect on the `current` MINOR entry's attestation radios: `null` on
   *  the first child (an explicit, unselected choice), then the relationship attested on the
   *  previously-signed child (carried forward with a note). Only meaningful when `kind` is
   *  `'minor'`. */
  carriedRelationship: string | null;
}

/**
 * Order a moment's items deterministically (member-waivers T4 ordering rule): the signer's own
 * documents first, by document-kind rank (release, then acknowledgements, then agreements) and
 * title within a rank; then the per-child Part Two entries, grouped by child (children ordered by
 * name) and ranked the same way within a child. A stable order matters because the moment's
 * progress ("Document i of N") and the current/upcoming split both read positionally.
 */
export function orderSigningItems(items: SigningItem[]): SigningItem[] {
  const rank = (item: SigningItem): number => DOCUMENT_KIND_RANK[item.documentKind] ?? 99;
  const personal = items.filter((item) => item.kind === 'personal');
  const minors = items.filter((item) => item.kind === 'minor');

  personal.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  minors.sort(
    (a, b) =>
      (a.minor?.name ?? '').localeCompare(b.minor?.name ?? '') ||
      rank(a) - rank(b) ||
      a.title.localeCompare(b.title),
  );

  return [...personal, ...minors];
}

/**
 * Build the signing moment from its items (member-waivers T4): orders them, assigns each a
 * `signed` / `current` / `upcoming` state (every already-signed item is `signed`; the first
 * outstanding item is `current` and expands; the rest are `upcoming` and muted), derives every
 * label the component renders, and carries the "type once, sign each" name and the AS 09.65.292
 * attestation forward from the most recent signature. `memberName` seeds nothing on its own (the
 * first signature is always typed fresh); it is unused here deliberately, kept off the signature
 * so a member confirms their own legal name rather than accepting a pre-filled one.
 */
export function buildSigningMoment(items: SigningItem[], opts: { season: number }): SigningMoment {
  const ordered = orderSigningItems(items);
  const total = ordered.length;

  // The name and relationship carried forward come from the LAST signature in document order among
  // the already-signed entries, so a member who signs top-to-bottom sees the name they just used
  // prefilled on the next entry.
  let lastSignedName = '';
  let lastSignedMinorRelationship: string | null = null;
  let currentAssigned = false;

  const entries: SigningEntry[] = ordered.map((item, index) => {
    const signed = item.signature !== undefined;
    let state: SigningEntry['state'];
    if (signed) {
      state = 'signed';
      lastSignedName = item.signature!.personName;
      if (item.kind === 'minor') lastSignedMinorRelationship = item.signature!.signerRelationship;
    } else if (!currentAssigned) {
      state = 'current';
      currentAssigned = true;
    } else {
      state = 'upcoming';
    }

    const framing = item.kind === 'minor' && item.minor ? minorFramingLine(item.minor.name) : framingLine(item.documentId);

    return {
      key: item.key,
      kind: item.kind,
      documentId: item.documentId,
      version: item.version,
      documentKind: item.documentKind,
      title: item.title,
      bodyHtml: item.bodyHtml ?? '',
      minor: item.minor,
      framingLine: framing,
      state,
      receiptText: signed ? `Signed ${formatSignedDate(item.signature!.signedAt)} as ${item.signature!.personName}.` : null,
      progressLabel: state === 'current' ? `Document ${index + 1} of ${total}` : null,
      // Only the current entry reads its prefill; upcoming entries recompute on the next load once
      // they become current, so a stale prefill can never be submitted.
      prefillName: state === 'current' ? lastSignedName : '',
      carriedRelationship: state === 'current' && item.kind === 'minor' ? lastSignedMinorRelationship : null,
    };
  });

  const signedCount = entries.filter((entry) => entry.state === 'signed').length;

  return {
    entries,
    total,
    signedCount,
    allSigned: total > 0 && signedCount === total,
    welcome: buildWelcome(opts.season, total),
  };
}

/** The built moment the component renders. */
export interface SigningMoment {
  entries: SigningEntry[];
  total: number;
  signedCount: number;
  allSigned: boolean;
  welcome: WelcomeLine;
}

/** The household-complete loop (member-waivers T5b, docs/2026-07-17-member-waivers-design.md
 * ratified decision 7 as amended 2026-07-18): once a signer's own moment above is done, a
 * join/renewal context still checks whether the whole household has finished before payment can
 * proceed. `signerOwnDone` is true once nothing remains for the person actually viewing the
 * page, independent of anyone else -- `total === 0` (nothing ever applied to them) counts the same
 * as `allSigned` (they cleared everything). */
export function signerOwnDone(moment: Pick<SigningMoment, 'total' | 'allSigned'>): boolean {
  return moment.total === 0 || moment.allSigned;
}

// `firstNameOf`/`joinNames` (`{first name}` throughout signing-framing-copy.md's own household-
// loop copy, and the natural join for naming several remaining adults in one sentence) are
// imported at this file's own top (from `person-name.ts`, shared with the portal landing's own
// waiver rows) and re-exported below to keep this module's existing public surface unchanged.

/** The waiting-state intro line (signing-framing-copy.md: replaces the welcome body once the
 *  signer's own documents are done but the household is not complete): "Your signatures are done.
 *  {name}'s are needed before payment.", `{name}` a natural-language join of every remaining
 *  OTHER adult's first name. */
export function waitingIntroLine(remainingAdultNames: string[]): string {
  return `Your signatures are done. ${joinNames(remainingAdultNames.map(firstNameOf))}'s are needed before payment.`;
}

/** One row in the household-signatures block (signing-framing-copy.md's "The household-signatures
 *  block"): "You" (the signer's own progress), the household's own minors once they are covered
 *  (always true once {@link signerOwnDone}, since a minor's Part Two is always part of the
 *  signer's own moment), and one row per OTHER adult still owing their own signatures, each with
 *  its own nudge action. */
export interface HouseholdSignatureRow {
  key: string;
  label: string;
  statusText: string;
  /** Present only on an outstanding OTHER adult's own row: the member id the nudge form's hidden
   *  `targetMemberId` field submits. */
  nudgeMemberId: string | null;
  nudgeButtonLabel: string | null;
  /** The waiting card's own title ("Waiting on {name}") and explanatory line, verbatim from
   *  signing-framing-copy.md's "The waiting card" -- present only alongside a nudge action. */
  waitingCardTitle: string | null;
  waitingCardLine: string | null;
}

/**
 * Build the household-signatures block. Only meaningful once the signer's own moment is done
 * ({@link signerOwnDone}); the caller shows nothing before that point (there is no other adult's
 * own status to report yet, and the signer's own accordion above already carries their own
 * progress). `signerSignedCount`/`signerTotal` come straight from the built {@link SigningMoment}
 * ("You · {signed count} of {total} signed"); `minorNames` lists the household's own minors, in
 * `requirements.minors`'s own order.
 */
export function buildHouseholdSignatureRows(args: {
  signerMemberId: string;
  signerSignedCount: number;
  signerTotal: number;
  minorNames: string[];
  requirements: HouseholdRequirements;
}): HouseholdSignatureRow[] {
  const rows: HouseholdSignatureRow[] = [
    { key: 'you', label: 'You', statusText: `${args.signerSignedCount} of ${args.signerTotal} signed`, nudgeMemberId: null, nudgeButtonLabel: null, waitingCardTitle: null, waitingCardLine: null },
  ];

  if (args.minorNames.length > 0) {
    rows.push({
      key: 'children',
      label: args.minorNames.join(', '),
      statusText: 'covered by your Part Two signatures above',
      nudgeMemberId: null,
      nudgeButtonLabel: null,
      waitingCardTitle: null,
      waitingCardLine: null,
    });
  }

  for (const remaining of householdSignatureGate(args.requirements).remaining) {
    if (remaining.role !== 'adult' || remaining.memberId === args.signerMemberId) continue;
    const firstName = firstNameOf(remaining.name);
    rows.push({
      key: remaining.memberId,
      label: remaining.name,
      statusText: `${remaining.outstandingCount} of their own to sign—payment and membership wait on these`,
      nudgeMemberId: remaining.memberId,
      nudgeButtonLabel: `Email ${firstName} a sign-in link`,
      waitingCardTitle: `Waiting on ${firstName}`,
      waitingCardLine: `${remaining.outstandingCount} documents need ${firstName}'s own signature—a signature is personal, so no one else can sign them. Payment and your family's ${args.requirements.season} membership unlock when everyone has signed.`,
    });
  }

  return rows;
}
