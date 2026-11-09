// The sound-cue schedule for a workout program: what rings or is said, and at which second.
//
// Pure and browser-safe: no audio, storage, UI, framework, network, timers, clock or randomness. A
// host plays the cues however it likes (the bell file, a buzzer, speech) and asks this module when.
// With DEFAULT_CUE_SETTINGS the bell and knock fall on the very seconds the gym TV rings them today
// (wallRoundTimer.ts roundSounds); the tests step both one second at a time and compare.
//
// Timing comes from deriveProgramPosition (workoutPrograms.ts), the one statement of the program's
// timing rule. This module reads it second by second and never restates the arithmetic.

import { KNOCK_SECONDS } from './wallRoundTimer';
import { deriveProgramPosition, type ProgramPosition, type WorkoutProgram } from './workoutPrograms';

export interface CueSettings {
  endSound: 'bell' | 'buzzer';
  knock: boolean;
  voiceCountdown: boolean;
  lastRoundCall: boolean;
  switchCall: boolean;
}

/** Today's gym TV: bell and knock, no voice. */
export const DEFAULT_CUE_SETTINGS: CueSettings = {
  endSound: 'bell',
  knock: true,
  voiceCountdown: false,
  lastRoundCall: false,
  switchCall: false,
};

/** What is said. English only. */
export const CUE_WORDS = {
  tenSeconds: '10 seconds',
  lastRound: 'last round',
  switch: 'switch',
  countdown: ['3', '2', '1'],
} as const;

/** A work period must be longer than this for the "10 seconds" call. */
export const VOICE_TEN_SECONDS = 10;
/** A rest period must be longer than this for the 3, 2, 1 count. */
export const VOICE_COUNTDOWN_SECONDS = 3;

export type CueWhat =
  | 'round_start'
  | 'round_end'
  | 'round_end_start'
  | 'knock'
  | 'ten_seconds'
  | 'rest_countdown'
  | 'last_round'
  | 'switch';

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
export function cueSchedule(program: WorkoutProgram, settings: CueSettings): Cue[] {
  const cues: Cue[] = [];
  const total = deriveProgramPosition(program, 0).totalSeconds;
  let prev: ProgramPosition | null = null;
  let periodLength = 0;

  for (let t = 0; t <= total; t += 1) {
    const pos = deriveProgramPosition(program, t);
    const newPeriod = prev === null || prev.phase !== pos.phase || prev.overallRound !== pos.overallRound;
    if (newPeriod) periodLength = pos.secondsLeft;
    const ended = prev !== null && prev.phase === 'work' && newPeriod ? prev : null;
    const workStarted = pos.phase === 'work' && newPeriod;

    if (ended || workStarted) {
      const sound = settings.endSound;
      if (ended && workStarted) cues.push({ atSecond: t, sound, what: 'round_end_start', overallRound: pos.overallRound });
      else if (workStarted) cues.push({ atSecond: t, sound, what: 'round_start', overallRound: pos.overallRound });
      else if (ended) cues.push({ atSecond: t, sound, what: 'round_end', overallRound: ended.overallRound });
    }

    if (settings.knock && pos.phase === 'work' && periodLength > KNOCK_SECONDS && pos.secondsLeft === KNOCK_SECONDS) {
      cues.push({ atSecond: t, sound: 'knock', what: 'knock', overallRound: pos.overallRound });
    }

    const voice = (what: CueWhat, words: string, overallRound: number): void => {
      cues.push({ atSecond: t, sound: 'voice', what, words, overallRound });
    };
    if (settings.switchCall && ended && ended.overallRound < pos.overallRounds) {
      voice('switch', CUE_WORDS.switch, ended.overallRound);
    }
    if (settings.lastRoundCall && workStarted && pos.overallRound === pos.overallRounds && pos.overallRounds > 1) {
      voice('last_round', CUE_WORDS.lastRound, pos.overallRound);
    }
    if (settings.voiceCountdown) {
      if (pos.phase === 'work' && periodLength > VOICE_TEN_SECONDS && pos.secondsLeft === VOICE_TEN_SECONDS) {
        voice('ten_seconds', CUE_WORDS.tenSeconds, pos.overallRound);
      }
      if (pos.phase === 'rest' && periodLength > VOICE_COUNTDOWN_SECONDS && pos.secondsLeft <= VOICE_COUNTDOWN_SECONDS) {
        voice('rest_countdown', CUE_WORDS.countdown[VOICE_COUNTDOWN_SECONDS - pos.secondsLeft], pos.overallRound);
      }
    }
    prev = pos;
  }
  return cues;
}
