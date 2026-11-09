import { type WorkoutProgram } from './workoutPrograms';
export interface CueSettings {
    endSound: 'bell' | 'buzzer';
    knock: boolean;
    voiceCountdown: boolean;
    lastRoundCall: boolean;
    switchCall: boolean;
}
/** Today's gym TV: bell and knock, no voice. */
export declare const DEFAULT_CUE_SETTINGS: CueSettings;
/** What is said. English only. */
export declare const CUE_WORDS: {
    readonly tenSeconds: "10 seconds";
    readonly lastRound: "last round";
    readonly switch: "switch";
    readonly countdown: readonly ["3", "2", "1"];
};
/** A work period must be longer than this for the "10 seconds" call. */
export declare const VOICE_TEN_SECONDS = 10;
/** A rest period must be longer than this for the 3, 2, 1 count. */
export declare const VOICE_COUNTDOWN_SECONDS = 3;
export type CueWhat = 'round_start' | 'round_end' | 'round_end_start' | 'knock' | 'ten_seconds' | 'rest_countdown' | 'last_round' | 'switch';
export interface Cue {
    /** Seconds from the start of the program. */
    atSecond: number;
    sound: 'bell' | 'buzzer' | 'knock' | 'voice';
    what: CueWhat;
    words?: string;
    /**
     * The 1-based round the cue belongs to: the round that starts for round_start, round_end_start and
     * last_round; the round that ends for round_end and switch; the round the period is in otherwise.
     */
    overallRound: number;
}
/**
 * Every cue of a program, sorted by second; inside a second: bell or buzzer, knock, then voice
 * (switch, last round, ten seconds or countdown). A round that ends as the next starts (no rest)
 * rings one strike, round_end_start.
 */
export declare function cueSchedule(program: WorkoutProgram, settings: CueSettings): Cue[];
