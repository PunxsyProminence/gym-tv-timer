import { type RoundTimerSettings } from './roundTimers';
export interface WorkoutBlock {
    label: string;
    rounds: number;
    workSeconds: number;
    restSeconds: number;
}
export interface WorkoutProgram {
    version: 1;
    name: string;
    blocks: WorkoutBlock[];
}
export declare const WORKOUT_PROGRAM_LIMITS: {
    readonly name: {
        readonly min: 1;
        readonly max: 60;
    };
    readonly label: {
        readonly min: 0;
        readonly max: 40;
    };
    readonly blocks: {
        readonly min: 1;
        readonly max: 20;
    };
    readonly rounds: {
        readonly min: 1;
        readonly max: 100;
    };
    readonly workSeconds: {
        readonly min: 1;
        readonly max: 3600;
    };
    readonly restSeconds: {
        readonly min: 0;
        readonly max: 3600;
    };
    readonly totalSeconds: {
        readonly max: 14400;
    };
};
export type ProgramPhase = 'work' | 'rest' | 'done';
export interface ProgramPosition {
    phase: ProgramPhase;
    /** 0-based index of the block the room is in (the last block once done). */
    blockIndex: number;
    blockLabel: string;
    /** 1-based round within the block (or resting after it). */
    roundInBlock: number;
    roundsInBlock: number;
    /** 1-based round across the whole program. */
    overallRound: number;
    overallRounds: number;
    /** Seconds left in the current work or rest period; 0 when done. */
    secondsLeft: number;
    totalSeconds: number;
}
/** Whole seconds the program runs: every period, minus the rest after the last round. */
export declare function programTotalSeconds(program: WorkoutProgram): number;
/** Rounds across every block. */
export declare function programTotalRounds(program: WorkoutProgram): number;
/** Where the program is after `elapsedSeconds` of running. Negative or fractional input is floored and clamped at 0. */
export declare function deriveProgramPosition(program: WorkoutProgram, elapsedSeconds: number): ProgramPosition;
/** The existing single round timer settings as a one-block program. */
export declare function singleBlockProgram(settings: RoundTimerSettings, name?: string): WorkoutProgram;
export type WorkoutProgramValidation = {
    ok: true;
    program: WorkoutProgram;
} | {
    ok: false;
    problems: string[];
};
/** Checks anything and never throws. Returns a normalized copy: names and labels trimmed, extra keys dropped. */
export declare function validateWorkoutProgram(input: unknown): WorkoutProgramValidation;
