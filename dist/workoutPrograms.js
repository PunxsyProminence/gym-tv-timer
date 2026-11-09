"use strict";
// Workout programs: mixed intervals as an ordered list of blocks, and the saved-workout shape.
//
// Pure and browser-safe: no storage, UI, framework, network, timers, clock or randomness. A host
// keeps the program wherever it likes (this package holds no account, device or person id) and asks
// this module where a given elapsed second falls. Nothing here limits how many programs a host
// saves; that is the apps' to decide.
//
// TIMING RULE. The program is the blocks' rounds in order, flattened. Each round is work then rest,
// and the rest follows every round EXCEPT the program's last round. A one-block program therefore
// runs work, rest, ..., work, exactly as roundTimers.ts deriveRoundTimer does. A rest of 0 seconds
// is no period at all. The rest after the last round of a block that is not the last block is that
// block's own restSeconds.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKOUT_PROGRAM_LIMITS = void 0;
exports.programTotalSeconds = programTotalSeconds;
exports.programTotalRounds = programTotalRounds;
exports.deriveProgramPosition = deriveProgramPosition;
exports.singleBlockProgram = singleBlockProgram;
exports.validateWorkoutProgram = validateWorkoutProgram;
const roundTimers_1 = require("./roundTimers");
exports.WORKOUT_PROGRAM_LIMITS = {
    name: { min: 1, max: 60 },
    label: { min: 0, max: 40 },
    blocks: { min: 1, max: 20 },
    rounds: roundTimers_1.ROUND_TIMER_LIMITS.roundsTotal,
    workSeconds: roundTimers_1.ROUND_TIMER_LIMITS.roundSeconds,
    restSeconds: roundTimers_1.ROUND_TIMER_LIMITS.restSeconds,
    totalSeconds: { max: 14400 },
};
function blockSeconds(block) {
    return block.rounds * (block.workSeconds + block.restSeconds);
}
/** Whole seconds the program runs: every period, minus the rest after the last round. */
function programTotalSeconds(program) {
    const blocks = program.blocks;
    if (blocks.length === 0)
        return 0;
    let total = 0;
    for (const block of blocks)
        total += blockSeconds(block);
    return total - blocks[blocks.length - 1].restSeconds;
}
/** Rounds across every block. */
function programTotalRounds(program) {
    let rounds = 0;
    for (const block of program.blocks)
        rounds += block.rounds;
    return rounds;
}
/** Where the program is after `elapsedSeconds` of running. Negative or fractional input is floored and clamped at 0. */
function deriveProgramPosition(program, elapsedSeconds) {
    const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.floor(elapsedSeconds)) : 0;
    const totalSeconds = programTotalSeconds(program);
    const overallRounds = programTotalRounds(program);
    const lastIndex = program.blocks.length - 1;
    const last = program.blocks[lastIndex];
    if (!last || elapsed >= totalSeconds) {
        return {
            phase: 'done',
            blockIndex: Math.max(0, lastIndex),
            blockLabel: last ? last.label : '',
            roundInBlock: last ? last.rounds : 0,
            roundsInBlock: last ? last.rounds : 0,
            overallRound: overallRounds,
            overallRounds,
            secondsLeft: 0,
            totalSeconds,
        };
    }
    let offset = 0;
    let roundsBefore = 0;
    for (let i = 0; i <= lastIndex; i += 1) {
        const block = program.blocks[i];
        const span = blockSeconds(block) - (i === lastIndex ? block.restSeconds : 0);
        if (elapsed < offset + span) {
            const into = elapsed - offset;
            const cycle = block.workSeconds + block.restSeconds;
            const index = Math.floor(into / cycle);
            const inCycle = into - index * cycle;
            const working = inCycle < block.workSeconds;
            return {
                phase: working ? 'work' : 'rest',
                blockIndex: i,
                blockLabel: block.label,
                roundInBlock: index + 1,
                roundsInBlock: block.rounds,
                overallRound: roundsBefore + index + 1,
                overallRounds,
                secondsLeft: working ? block.workSeconds - inCycle : cycle - inCycle,
                totalSeconds,
            };
        }
        offset += span;
        roundsBefore += block.rounds;
    }
    // Unreachable: elapsed < totalSeconds always lands in a block.
    throw new Error('deriveProgramPosition: elapsed past every block');
}
/** The existing single round timer settings as a one-block program. */
function singleBlockProgram(settings, name = 'Rounds') {
    return {
        version: 1,
        name,
        blocks: [{ label: '', rounds: settings.roundsTotal, workSeconds: settings.roundSeconds, restSeconds: settings.restSeconds }],
    };
}
// Problem codes are stable strings. Program-level codes stand alone; block-level codes carry the
// block's 0-based index after a colon, for example BLOCK_ROUNDS_RANGE:2.
//   PROGRAM_SHAPE, PROGRAM_VERSION, PROGRAM_NAME_LENGTH, PROGRAM_BLOCKS_COUNT, PROGRAM_TOO_LONG,
//   BLOCK_SHAPE:i, BLOCK_LABEL_LENGTH:i, BLOCK_ROUNDS_RANGE:i, BLOCK_WORK_RANGE:i, BLOCK_REST_RANGE:i
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function inRange(value, range) {
    return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max;
}
/** Checks anything and never throws. Returns a normalized copy: names and labels trimmed, extra keys dropped. */
function validateWorkoutProgram(input) {
    try {
        return validate(input);
    }
    catch {
        return { ok: false, problems: ['PROGRAM_SHAPE'] };
    }
}
function validate(input) {
    if (!isRecord(input))
        return { ok: false, problems: ['PROGRAM_SHAPE'] };
    const problems = [];
    if (input.version !== 1)
        problems.push('PROGRAM_VERSION');
    const name = typeof input.name === 'string' ? input.name.trim() : null;
    if (name === null)
        problems.push('PROGRAM_SHAPE');
    else if (!inRange(name.length, exports.WORKOUT_PROGRAM_LIMITS.name))
        problems.push('PROGRAM_NAME_LENGTH');
    const blocks = [];
    if (!Array.isArray(input.blocks)) {
        problems.push('PROGRAM_SHAPE');
    }
    else if (!inRange(input.blocks.length, exports.WORKOUT_PROGRAM_LIMITS.blocks)) {
        problems.push('PROGRAM_BLOCKS_COUNT'); // length checked before walking
    }
    else {
        input.blocks.forEach((raw, i) => {
            if (!isRecord(raw)) {
                problems.push(`BLOCK_SHAPE:${i}`);
                return;
            }
            const label = typeof raw.label === 'string' ? raw.label.trim() : null;
            if (label === null)
                problems.push(`BLOCK_SHAPE:${i}`);
            else if (!inRange(label.length, exports.WORKOUT_PROGRAM_LIMITS.label))
                problems.push(`BLOCK_LABEL_LENGTH:${i}`);
            if (!inRange(raw.rounds, exports.WORKOUT_PROGRAM_LIMITS.rounds))
                problems.push(`BLOCK_ROUNDS_RANGE:${i}`);
            if (!inRange(raw.workSeconds, exports.WORKOUT_PROGRAM_LIMITS.workSeconds))
                problems.push(`BLOCK_WORK_RANGE:${i}`);
            if (!inRange(raw.restSeconds, exports.WORKOUT_PROGRAM_LIMITS.restSeconds))
                problems.push(`BLOCK_REST_RANGE:${i}`);
            if (label !== null) {
                blocks.push({ label, rounds: raw.rounds, workSeconds: raw.workSeconds, restSeconds: raw.restSeconds });
            }
        });
    }
    if (problems.length === 0) {
        const program = { version: 1, name: name, blocks };
        if (programTotalSeconds(program) > exports.WORKOUT_PROGRAM_LIMITS.totalSeconds.max)
            problems.push('PROGRAM_TOO_LONG');
        else
            return { ok: true, program };
    }
    return { ok: false, problems };
}
