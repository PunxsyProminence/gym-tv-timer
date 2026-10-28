// The round clock of a live session run (WO-N1-03, issue #1460): rounds of work and rest that the
// coach configures, starts, pauses, resumes and ends, shown on every TV showing the run.
//
// Table owned by infra/azure/pilot_slice_postgres_round_timers_migration.sql. Nothing here issues
// DDL.
//
// THE SERVER OWNS THE CLOCK, as sessionScriptRuns.ts does for the session. Only the configuration
// and the start, pause and end instants are stored, each written with the database's now(). The
// round, work or rest, and the seconds left are derived at read time (deriveRoundTimer) against the
// database clock, so a TV that reloads and a second screen of the coach read the same round.
//
// WHO MAY DRIVE IT: exactly who may pause and resume the run itself -- the coach delivering it, from
// any of their screens. Another coach's run id answers 404, as sessionScriptRuns.ts
// requireOwnLiveRun does. No other rule is added here.
//
// A TIMER STARTS ONLY ON THE COACH'S START (N1-03-Q1 A). Configuring writes 'ready'.
//
// IT IS AN INDEPENDENT CLOCK. Pausing the session does not pause the rounds, and finishing the run
// writes nothing here: once the run is not live its timer state means nothing, and no reader shows
// it (the TV shows only a live run; the coach's read answers 409). A later reader of history must
// treat a timer on a settled run as ended.

export type RoundTimerState = 'ready' | 'running' | 'paused' | 'ended';

/** What the room sees right now. 'done' is a running timer whose last round has finished. */
export type RoundTimerPhase = 'ready' | 'work' | 'rest' | 'done' | 'ended';

export interface RoundTimerSettings {
  roundSeconds: number;
  restSeconds: number;
  roundsTotal: number;
}

export const ROUND_TIMER_LIMITS = {
  roundSeconds: { min: 1, max: 3600 },
  restSeconds: { min: 0, max: 3600 },
  roundsTotal: { min: 1, max: 100 },
} as const;

export interface RoundTimerRow {
  round_seconds: number;
  rest_seconds: number;
  rounds_total: number;
  state: RoundTimerState;
  started_at: Date | string | null;
  paused_at: Date | string | null;
  paused_seconds: number;
  server_time: Date | string;
}

// THE ALLOWLIST for every screen that shows a timer, the TV included. No person field, no account
// id: configured_by_account_id stays in the database.
export const ROUND_TIMER_FIELDS = [
  'state',
  'phase',
  'round',
  'rounds_total',
  'round_seconds',
  'rest_seconds',
  'seconds_left',
  'is_paused',
] as const;

export interface RoundTimerView {
  state: RoundTimerState;
  phase: RoundTimerPhase;
  /** 1-based round the room is in (or resting after); 0 before the start. */
  round: number;
  rounds_total: number;
  round_seconds: number;
  rest_seconds: number;
  /** Seconds left in the current work or rest period; 0 when ready, done or ended. */
  seconds_left: number;
  is_paused: boolean;
}

function epochMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Whole seconds of rounds the room has run: paused time and every adjustment taken off. */
function elapsedSeconds(row: RoundTimerRow): number {
  if (!row.started_at) return 0;
  const reference = row.paused_at ? epochMs(row.paused_at) : epochMs(row.server_time);
  return Math.max(0, Math.floor((reference - epochMs(row.started_at)) / 1000) - row.paused_seconds);
}

/**
 * The room's reading at `server_time`. Pure: the same row and clock always give the same answer,
 * which is what lets two screens agree. Rounds run work, rest, work, rest ... work: there is no
 * rest after the last round.
 */
export function deriveRoundTimer(row: RoundTimerRow): RoundTimerView {
  const base = {
    state: row.state,
    rounds_total: row.rounds_total,
    round_seconds: row.round_seconds,
    rest_seconds: row.rest_seconds,
    is_paused: row.state === 'paused',
  };
  if (row.state === 'ready' || !row.started_at) {
    return { ...base, phase: row.state === 'ended' ? 'ended' : 'ready', round: 0, seconds_left: 0 };
  }
  if (row.state === 'ended') {
    return { ...base, phase: 'ended', round: 0, seconds_left: 0 };
  }

  const elapsed = elapsedSeconds(row);
  const cycle = row.round_seconds + row.rest_seconds;
  const total = row.rounds_total * row.round_seconds + (row.rounds_total - 1) * row.rest_seconds;
  if (elapsed >= total) {
    return { ...base, phase: 'done', round: row.rounds_total, seconds_left: 0 };
  }
  const index = Math.floor(elapsed / cycle);
  const into = elapsed - index * cycle;
  if (into < row.round_seconds) {
    return { ...base, phase: 'work', round: index + 1, seconds_left: row.round_seconds - into };
  }
  return { ...base, phase: 'rest', round: index + 1, seconds_left: cycle - into };
}

/** A timer for the coach's screens, with the revision of exactly that reading. */
export interface RevisedRoundTimer {
  timer: RoundTimerView;
  revision: string;
}

export type RoundTimerAction = 'start' | 'pause' | 'resume' | 'end';

// +30 SEC AND REPEAT (OD-2026-10-17-010, "A": built after the restyle; +30 timing "A: After 30 sec").
//
// Both move the room's clock BACK by adding to paused_seconds, which every reader already takes off
// the elapsed time, so no column is added and the TV needs no change: it derives the new reading
// like any other.
//   +30 SEC  gives the current work or rest period thirty more seconds. Pushing the clock back 30 s
//            is exact only once the period is 30 s old -- earlier, it would rewind into the period
//            before -- so it is refused until then (Jason's "After 30 sec").
//   REPEAT   runs the round again: back to the start of this round while it is being worked, or of
//            the round just finished during its rest or after the last one. The round number shows
//            again and the TV rings its start bell again.
// ON THE TV (wallRoundTimer.ts): REPEAT reads as a fresh start of the round and rings its start bell;
// +30 gives back the round's knock and end bell (releasedKeys) so they ring at the new end. One edge
// is known: a +30 pressed 30-37 s into a period lands within the TV's freshness window of the start,
// which the TV cannot tell from a restart, so it can ring the start bell once (pinned in
// wallRoundTimer.test.ts). Opening +30 later would remove it; that is Jason's call, not ruled.
// Neither is a TRANSITIONS row: the state does not change, and moveRoundTimer answers a same-state
// move as a no-op. Each is a COMPARE-AND-SET on the revision the coach's screen last read, so a
// retried tap, or the same tap from a second screen, cannot add twice: the second answers
// ROUND_TIMER_STALE and that screen reads again.
export type RoundTimerAdjustment = 'add_30' | 'repeat';
export const ROUND_TIMER_ADD_SECONDS = 30;

/** How far back an adjustment moves the clock, or the code it is refused with. Pure. */
export function adjustmentShift(row: RoundTimerRow, adjustment: RoundTimerAdjustment): { shift: number } | { refused: string } {
  const view = deriveRoundTimer(row);
  if (view.state === 'ready' || view.state === 'ended') return { refused: `ROUND_TIMER_${view.state.toUpperCase()}` };
  const cycle = row.round_seconds + row.rest_seconds;
  if (view.phase === 'done') {
    if (adjustment === 'add_30') return { refused: 'ROUND_TIMER_DONE' };
    return { shift: elapsedSeconds(row) - (row.rounds_total - 1) * cycle };
  }
  const into = view.phase === 'work' ? row.round_seconds - view.seconds_left : row.rest_seconds - view.seconds_left;
  if (adjustment === 'add_30') {
    return into >= ROUND_TIMER_ADD_SECONDS ? { shift: ROUND_TIMER_ADD_SECONDS } : { refused: 'ROUND_TIMER_TOO_EARLY' };
  }
  return { shift: view.phase === 'work' ? into : into + row.round_seconds };
}
