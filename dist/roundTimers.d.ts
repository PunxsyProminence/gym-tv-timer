export type RoundTimerState = 'ready' | 'running' | 'paused' | 'ended';
/** What the room sees right now. 'done' is a running timer whose last round has finished. */
export type RoundTimerPhase = 'ready' | 'work' | 'rest' | 'done' | 'ended';
export interface RoundTimerSettings {
    roundSeconds: number;
    restSeconds: number;
    roundsTotal: number;
}
export declare const ROUND_TIMER_LIMITS: {
    readonly roundSeconds: {
        readonly min: 1;
        readonly max: 3600;
    };
    readonly restSeconds: {
        readonly min: 0;
        readonly max: 3600;
    };
    readonly roundsTotal: {
        readonly min: 1;
        readonly max: 100;
    };
};
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
export declare const ROUND_TIMER_FIELDS: readonly ["state", "phase", "round", "rounds_total", "round_seconds", "rest_seconds", "seconds_left", "is_paused"];
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
/**
 * The room's reading at `server_time`. Pure: the same row and clock always give the same answer,
 * which is what lets two screens agree. Rounds run work, rest, work, rest ... work: there is no
 * rest after the last round.
 */
export declare function deriveRoundTimer(row: RoundTimerRow): RoundTimerView;
/** A timer for the coach's screens, with the revision of exactly that reading. */
export interface RevisedRoundTimer {
    timer: RoundTimerView;
    revision: string;
}
export type RoundTimerAction = 'start' | 'pause' | 'resume' | 'end';
export type RoundTimerAdjustment = 'add_30' | 'repeat';
export declare const ROUND_TIMER_ADD_SECONDS = 30;
/** How far back an adjustment moves the clock, or the code it is refused with. Pure. */
export declare function adjustmentShift(row: RoundTimerRow, adjustment: RoundTimerAdjustment): {
    shift: number;
} | {
    refused: string;
};
