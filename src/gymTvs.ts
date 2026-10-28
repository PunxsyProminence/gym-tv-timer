import { randomInt } from 'node:crypto';

import { PilotError } from './errors';

// Gym TVs: pairing from the coach dashboard, and the TV's own device key.
//
// Columns owned by infra/azure/pilot_slice_postgres_gym_tvs_migration.sql. Nothing here issues DDL.
//
// HOW A TV GETS IN (Jason, 2026-10-06: "Pair with code (Recommended)"). A coach presses Pair a TV
// on the dashboard and names it ("Gym main", "House"). The server mints a 6-character code, shows
// it ONCE, and stores only its hash with a 5-minute expiry. Someone types the code on the TV. The
// TV endpoint redeems it: the row gets a device key (stored hashed; the plain key goes into the
// TV's httpOnly cookie and nowhere else), the code is cleared, and the TV is paired "Until
// disconnected" (Jason). A keyed read touches last_seen_at. Disconnect sets revoked_at: the key is
// refused from then on, and the row stays in the table. The Paired TVs list keeps showing it as
// DISCONNECTED for GYM_TV_DISCONNECTED_LISTED_DAYS, then drops it (listGymTvs).
//
// WHAT THE KEY IS NOT. It is not a session and it is not an account. It opens exactly the TV read
// (readGymTvScreen, below: the live session plus the wall board) and nothing else in the app, so a
// remote in the wrong hands reaches the same screen the room already sees and no athlete record.
// One side effect, nothing returned: a read with a session pointer first settles the gym's runs
// idle for three hours (sessionScriptRuns.ts sweepIdleRuns, OD-2026-10-21-001 ruling 2).
//
// ONLY HASHES ARE STORED. A database read yields neither a code nor a key. The code's space is
// 32^6 (about a billion): small enough to brute force offline against a leaked hash, which is why
// it lives five minutes and is single use, and why the TV endpoint sits behind a per-IP budget.
//
// WHAT A TV SHOWS (S2b). A coach running a live session with "Show on TV" on sends it to a paired
// TV: current_run_id. Jason (OD-2026-10-06-014, rulings 5-6): "TV session should be tied to coach,
// there may be two coachs running sessions at the same time", and any coach may choose any gym TV,
// one session per TV. So the run must be the caller's own, and a TV already showing ANOTHER coach's
// live session is refused (TV_IN_USE) rather than taken over -- replace-vs-refuse is not ruled,
// and the refusal is the one that cannot lose a class mid-round.
//
// "ON THE TV" IS DERIVED, NEVER TRUSTED FROM THE POINTER ALONE. current_run_id is only honoured
// while that run is in_progress AND show_on_wall. Finishing a run or switching it off the TV does
// not write to this table on purpose: a coach ending a class must never depend on the TV table
// existing in that environment. The TV read, the Paired TVs list and the in-use check all apply
// the same liveness condition (LIVE_SHOWN_RUN), so a stale pointer reads as "nothing on this TV".

export const PAIR_CODE_LENGTH = 6;
export const PAIR_CODE_LIFETIME_MS = 5 * 60 * 1000;
// No 0/O/1/I: a code is typed with a TV remote, where those four are indistinguishable at a
// distance, and a mistyped code is a failed attempt against the budget.
export const PAIR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// How many codes one coach may have minted in the last ten minutes. A coach pairing two TVs and
// mistyping once is three; this is a brake on a script, not on a person.
export const PAIR_CODE_MINT_LIMIT = 5;
export const PAIR_CODE_MINT_WINDOW_MS = 10 * 60 * 1000;
export const TV_NAME_MAX_LENGTH = 60;

export class GymTvError extends PilotError {
  constructor(status: number, code: string) {
    super(status, code, code);
  }
}

export function normalizePairCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isWellFormedPairCode(code: string): boolean {
  if (code.length !== PAIR_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!PAIR_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function newPairCode(): string {
  let code = '';
  for (let i = 0; i < PAIR_CODE_LENGTH; i += 1) {
    code += PAIR_CODE_ALPHABET[randomInt(PAIR_CODE_ALPHABET.length)];
  }
  return code;
}

export function validateTvName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new GymTvError(400, 'TV_NAME_REQUIRED');
  }
  const name = raw.trim();
  if (name.length === 0 || name.length > TV_NAME_MAX_LENGTH) {
    throw new GymTvError(400, 'TV_NAME_LENGTH');
  }
  return name;
}
