import type { RoundTimerView } from './roundTimers';
export interface WallRoundReading {
    state: RoundTimerView['state'];
    phase: RoundTimerView['phase'];
    round: number;
    rounds_total: number;
    seconds_left: number;
    /** For a reading counted on into "done" here: how many seconds ago the last round ended. */
    seconds_since_done?: number;
}
/** The reading `elapsed` whole seconds after `view` was read. Only a running timer moves. */
export declare function advanceRoundTimer(view: RoundTimerView, elapsed: number): WallRoundReading;
/** Seconds before the end of a round when the knock sounds (the gym's ten-second clapper). */
export declare const KNOCK_SECONDS = 10;
export interface WallRoundSound {
    voice: 'bell' | 'knock';
    /** One per run, round and event. A key sounds at most once on a TV; one strike may carry two. */
    keys: string[];
}
export interface RoundConfig {
    round_seconds: number;
    rest_seconds: number;
}
/** How far a running round's count may step back on a poll (rounding, latency) and still be the same set. */
export declare const RESTART_TOLERANCE_SECONDS = 2;
/**
 * A new set of rounds on the same run: the coach ended or reset the timer, or ended, reconfigured
 * and started again between two polls -- a fresh round that is EARLIER than the last reading, or
 * the same round of a running set jumped back to its start by more than a poll's correction. A
 * poll's small backwards correction never looks like this: it lands near the end of a period, or
 * moves the count back by a second or two at most.
 */
export declare function isNewSet(prev: WallRoundReading | null, next: WallRoundReading, config: RoundConfig, fresh: number): boolean;
/**
 * How far back a reading must move the count, in seconds, to be time the coach added (+30 SEC) or a
 * TV that had counted on past an end it never reached, rather than a poll's correction. Corrections
 * are a few seconds (latency, clock skew); +30 SEC is thirty.
 */
export declare const RELEASE_BACK_SECONDS = 10;
/**
 * The sound keys to give back when a reading moves the count BACKWARDS by real time within the same
 * set: the coach pressed +30 SEC (or REPEAT while paused), or the TV had counted on past an end the
 * server had not reached. This round's knock and end, and the next round's start, are still to come
 * and must ring when they do. A poll's few-second correction gives nothing back (the bell it pulled
 * back across stays rung), and a new set (isNewSet) has keys of its own.
 */
export declare function releasedKeys(setKey: string, prev: WallRoundReading | null, next: WallRoundReading, config: RoundConfig, fresh: number): string[];
/**
 * What to sound going from one reading to the next:
 *   - the bell when a round ends and when the next one starts (one strike when they are the same
 *     moment, with no rest);
 *   - the knock when a round passes KNOCK_SECONDS left.
 * Only forward motion sounds: a poll that pulls the count back across a boundary rings nothing.
 * `fresh` is how many seconds old a transition may be and still sound; anything older (a reload,
 * a TV that slept) is past and stays silent. The first reading after a load has no `prev` and
 * sounds nothing. The caller gives a new set its own keys (isNewSet).
 */
export declare function roundSounds(setKey: string, prevReading: WallRoundReading | null, next: WallRoundReading, config: RoundConfig, fresh: number): WallRoundSound[];
/** The words on the wall. Never only a colour: rest, paused and stopped are said. */
export declare function roundPanelText(reading: WallRoundReading, roundSeconds: number): {
    label: string;
    time: string;
};
