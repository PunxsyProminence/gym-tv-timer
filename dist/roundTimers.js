"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUND_TIMER_ADD_SECONDS = exports.ROUND_TIMER_FIELDS = exports.ROUND_TIMER_LIMITS = void 0;
exports.deriveRoundTimer = deriveRoundTimer;
exports.adjustmentShift = adjustmentShift;
exports.ROUND_TIMER_LIMITS = {
    roundSeconds: { min: 1, max: 3600 },
    restSeconds: { min: 0, max: 3600 },
    roundsTotal: { min: 1, max: 100 },
};
// THE ALLOWLIST for every screen that shows a timer, the TV included. No person field, no account
// id: configured_by_account_id stays in the database.
exports.ROUND_TIMER_FIELDS = [
    'state',
    'phase',
    'round',
    'rounds_total',
    'round_seconds',
    'rest_seconds',
    'seconds_left',
    'is_paused',
];
function epochMs(value) {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
/** Whole seconds of rounds the room has run: paused time and every adjustment taken off. */
function elapsedSeconds(row) {
    if (!row.started_at)
        return 0;
    const reference = row.paused_at ? epochMs(row.paused_at) : epochMs(row.server_time);
    return Math.max(0, Math.floor((reference - epochMs(row.started_at)) / 1000) - row.paused_seconds);
}
/**
 * The room's reading at `server_time`. Pure: the same row and clock always give the same answer,
 * which is what lets two screens agree. Rounds run work, rest, work, rest ... work: there is no
 * rest after the last round.
 */
function deriveRoundTimer(row) {
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
exports.ROUND_TIMER_ADD_SECONDS = 30;
/** How far back an adjustment moves the clock, or the code it is refused with. Pure. */
function adjustmentShift(row, adjustment) {
    const view = deriveRoundTimer(row);
    if (view.state === 'ready' || view.state === 'ended')
        return { refused: `ROUND_TIMER_${view.state.toUpperCase()}` };
    const cycle = row.round_seconds + row.rest_seconds;
    if (view.phase === 'done') {
        if (adjustment === 'add_30')
            return { refused: 'ROUND_TIMER_DONE' };
        return { shift: elapsedSeconds(row) - (row.rounds_total - 1) * cycle };
    }
    const into = view.phase === 'work' ? row.round_seconds - view.seconds_left : row.rest_seconds - view.seconds_left;
    if (adjustment === 'add_30') {
        return into >= exports.ROUND_TIMER_ADD_SECONDS ? { shift: exports.ROUND_TIMER_ADD_SECONDS } : { refused: 'ROUND_TIMER_TOO_EARLY' };
    }
    return { shift: view.phase === 'work' ? into : into + row.round_seconds };
}
