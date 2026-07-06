// The 2026 season listing, static for Task 3 (the theme build). This is the exact schedule the
// north star (docs/superpowers/specs/assets/2026-07-06-asc-home-northstar.html in the cairn-cms
// repo) renders; Task 4 replaces this module's data with the club's live D1 events, categorized by
// the same C7-gold taxonomy (the `dot` flag below marks a class or clinic, per the spec's
// mission-first emphasis: "the club is an educational 501(c)(3)"), without touching the home
// template's markup.

/** One event row: its date range, its name, and the two independent emphasis flags the C7 recipe
 *  uses. `dot` marks a class or clinic (the gold accent dot); `muted` marks a routine, non-racing
 *  entry (a work party, a meeting) that reads in the quieter ink, not the north star's invented
 *  distinction between "notable" and "administrative" rows. */
export interface SeasonEvent {
  dateRange: string;
  name: string;
  dot?: boolean;
  muted?: boolean;
}

/** One month's (or the off-season's) group of events; groups never split across columns. */
export interface SeasonMonth {
  label: string;
  events: SeasonEvent[];
}

export const SEASON_2026: SeasonMonth[] = [
  {
    label: 'May',
    events: [
      { dateRange: 'May 16', name: 'Pre-spring work party', muted: true },
      { dateRange: 'May 23', name: 'Spring Work Party', muted: true },
      { dateRange: 'May 24', name: 'Icebreaker Regatta' },
    ],
  },
  {
    label: 'June',
    events: [
      { dateRange: 'Jun 12–14', name: 'Fleet Tune-Up Weekend', dot: true },
      { dateRange: 'Jun 18–21', name: 'Adult and Youth Intro Classes', dot: true },
    ],
  },
  {
    label: 'July',
    events: [
      { dateRange: 'Jul 4–5', name: 'Firecracker Regatta' },
      { dateRange: 'Jul 9–12', name: 'Adult and Youth Intro Classes', dot: true },
      { dateRange: 'Jul 25–26', name: 'Pirate Race & Youth Cup' },
    ],
  },
  {
    label: 'August',
    events: [{ dateRange: 'Aug 8', name: 'Fireweed Ladies Race' }],
  },
  {
    label: 'September',
    events: [
      { dateRange: 'Sep 5–7', name: "Governor's Cup" },
      { dateRange: 'Sep 12–13', name: 'Northern Lights Regatta' },
      { dateRange: 'Sep 19', name: 'Fall Work Party', muted: true },
    ],
  },
  {
    label: 'Off-season',
    events: [
      { dateRange: 'Oct 9–11', name: 'BNAC' },
      { dateRange: 'Nov 7', name: 'End-of-Season Celebration', muted: true },
      { dateRange: 'Nov 14', name: 'Annual Meeting', muted: true },
    ],
  },
];
