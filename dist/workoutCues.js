"use strict";
// The sound-cue schedule for a workout program: what rings or is said, and at which second.
//
// Pure and browser-safe: no audio, storage, UI, framework, network, timers, clock or randomness. A
// host plays the cues however it likes (the bell file, a buzzer, speech) and asks this module when.
// With DEFAULT_CUE_SETTINGS the bell and knock fall on the very seconds the gym TV rings them today
// (wallRoundTimer.ts roundSounds); the tests step both one second at a time and compare.
//
// Timing comes from deriveProgramPosition (workoutPrograms.ts), the one statement of the program's
// timing rule. This module reads it second by second and never restates the arithmetic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOICE_COUNTDOWN_SECONDS = exports.VOICE_TEN_SECONDS = exports.CUE_WORDS = exports.DEFAULT_CUE_SETTINGS = void 0;
exports.cueSchedule = cueSchedule;
const wallRoundTimer_1 = require("./wallRoundTimer");
const workoutPrograms_1 = require("./workoutPrograms");
/** Today's gym TV: bell and knock, no voice. */
exports.DEFAULT_CUE_SETTINGS = {
    endSound: 'bell',
    knock: true,
    voiceCountdown: false,
    lastRoundCall: false,
    switchCall: false,
};
/** What is said. English only. */
exports.CUE_WORDS = {
    tenSeconds: '10 seconds',
    lastRound: 'last round',
    switch: 'switch',
    countdown: ['3', '2', '1'],
};
/** A work period must be longer than this for the "10 seconds" call. */
exports.VOICE_TEN_SECONDS = 10;
/** A rest period must be longer than this for the 3, 2, 1 count. */
exports.VOICE_COUNTDOWN_SECONDS = 3;
/**
 * Every cue of a program, sorted by second; inside a second: bell or buzzer, knock, then voice
 * (switch, last round, ten seconds or countdown). A round that ends as the next starts (no rest)
 * rings one strike, round_end_start.
 */
function cueSchedule(program, settings) {
    const cues = [];
    const total = (0, workoutPrograms_1.deriveProgramPosition)(program, 0).totalSeconds;
    let prev = null;
    let periodLength = 0;
    for (let t = 0; t <= total; t += 1) {
        const pos = (0, workoutPrograms_1.deriveProgramPosition)(program, t);
        const newPeriod = prev === null || prev.phase !== pos.phase || prev.overallRound !== pos.overallRound;
        if (newPeriod)
            periodLength = pos.secondsLeft;
        const ended = prev !== null && prev.phase === 'work' && newPeriod ? prev : null;
        const workStarted = pos.phase === 'work' && newPeriod;
        if (ended || workStarted) {
            const sound = settings.endSound;
            if (ended && workStarted)
                cues.push({ atSecond: t, sound, what: 'round_end_start', overallRound: pos.overallRound });
            else if (workStarted)
                cues.push({ atSecond: t, sound, what: 'round_start', overallRound: pos.overallRound });
            else if (ended)
                cues.push({ atSecond: t, sound, what: 'round_end', overallRound: ended.overallRound });
        }
        if (settings.knock && pos.phase === 'work' && periodLength > wallRoundTimer_1.KNOCK_SECONDS && pos.secondsLeft === wallRoundTimer_1.KNOCK_SECONDS) {
            cues.push({ atSecond: t, sound: 'knock', what: 'knock', overallRound: pos.overallRound });
        }
        const voice = (what, words, overallRound) => {
            cues.push({ atSecond: t, sound: 'voice', what, words, overallRound });
        };
        if (settings.switchCall && ended && ended.overallRound < pos.overallRounds) {
            voice('switch', exports.CUE_WORDS.switch, ended.overallRound);
        }
        if (settings.lastRoundCall && workStarted && pos.overallRound === pos.overallRounds && pos.overallRounds > 1) {
            voice('last_round', exports.CUE_WORDS.lastRound, pos.overallRound);
        }
        if (settings.voiceCountdown) {
            if (pos.phase === 'work' && periodLength > exports.VOICE_TEN_SECONDS && pos.secondsLeft === exports.VOICE_TEN_SECONDS) {
                voice('ten_seconds', exports.CUE_WORDS.tenSeconds, pos.overallRound);
            }
            if (pos.phase === 'rest' && periodLength > exports.VOICE_COUNTDOWN_SECONDS && pos.secondsLeft <= exports.VOICE_COUNTDOWN_SECONDS) {
                voice('rest_countdown', exports.CUE_WORDS.countdown[exports.VOICE_COUNTDOWN_SECONDS - pos.secondsLeft], pos.overallRound);
            }
        }
        prev = pos;
    }
    return cues;
}
