import { ROUND_TIMER_LIMITS, deriveRoundTimer, type RoundTimerSettings } from './roundTimers';
import {
  WORKOUT_PROGRAM_LIMITS,
  deriveProgramPosition,
  programTotalRounds,
  programTotalSeconds,
  singleBlockProgram,
  validateWorkoutProgram,
  type WorkoutProgram,
} from './workoutPrograms';

const START = '2026-10-12T18:00:00.000Z';

const MIXED: WorkoutProgram = {
  version: 1,
  name: 'Mixed',
  blocks: [
    { label: 'Warm-up', rounds: 1, workSeconds: 300, restSeconds: 60 },
    { label: 'Rounds', rounds: 3, workSeconds: 180, restSeconds: 60 },
    { label: 'Tabata', rounds: 8, workSeconds: 20, restSeconds: 10 },
  ],
};

describe('equivalence with deriveRoundTimer', () => {
  const grid: RoundTimerSettings[] = [
    { roundSeconds: 180, restSeconds: 60, roundsTotal: 3 },
    { roundSeconds: 180, restSeconds: 0, roundsTotal: 3 },
    { roundSeconds: 1, restSeconds: 0, roundsTotal: 1 },
    { roundSeconds: 5, restSeconds: 7, roundsTotal: 1 },
    { roundSeconds: 2, restSeconds: 1, roundsTotal: 100 },
    { roundSeconds: 3, restSeconds: 0, roundsTotal: 100 },
    { roundSeconds: 20, restSeconds: 10, roundsTotal: 8 },
  ];

  test.each(grid)('%j matches every second', (settings) => {
    const program = singleBlockProgram(settings);
    const total = programTotalSeconds(program);
    for (let e = 0; e <= total + 5; e += 1) {
      const view = deriveRoundTimer({
        round_seconds: settings.roundSeconds,
        rest_seconds: settings.restSeconds,
        rounds_total: settings.roundsTotal,
        state: 'running',
        started_at: START,
        paused_at: null,
        paused_seconds: 0,
        server_time: new Date(Date.parse(START) + e * 1000).toISOString(),
      });
      const position = deriveProgramPosition(program, e);
      expect({ phase: position.phase, round: position.overallRound, left: position.secondsLeft }).toEqual({
        phase: view.phase,
        round: view.round,
        left: view.seconds_left,
      });
    }
  });
});

describe('deriveProgramPosition', () => {
  test('totals', () => {
    expect(programTotalSeconds(MIXED)).toBe(360 + 3 * 240 + 8 * 30 - 10);
    expect(programTotalRounds(MIXED)).toBe(12);
    expect(programTotalSeconds({ version: 1, name: 'x', blocks: [] })).toBe(0);
  });

  test.each([
    // elapsed, phase, block, roundInBlock, overall, left
    [0, 'work', 0, 1, 1, 300],
    [299, 'work', 0, 1, 1, 1],
    [300, 'rest', 0, 1, 1, 60],
    [359, 'rest', 0, 1, 1, 1],
    [360, 'work', 1, 1, 2, 180],
    [539, 'work', 1, 1, 2, 1],
    [540, 'rest', 1, 1, 2, 60],
    [600, 'work', 1, 2, 3, 180],
    [840, 'work', 1, 3, 4, 180],
    [1020, 'rest', 1, 3, 4, 60],
    [1079, 'rest', 1, 3, 4, 1],
    [1080, 'work', 2, 1, 5, 20],
    [1099, 'work', 2, 1, 5, 1],
    [1100, 'rest', 2, 1, 5, 10],
    [1109, 'rest', 2, 1, 5, 1],
    [1110, 'work', 2, 2, 6, 20],
    [1290, 'work', 2, 8, 12, 20],
    [1309, 'work', 2, 8, 12, 1],
  ] as const)('%ss in: %s, block %s, round %s (overall %s), %ss left', (elapsed, phase, block, round, overall, left) => {
    expect(deriveProgramPosition(MIXED, elapsed)).toMatchObject({
      phase,
      blockIndex: block,
      roundInBlock: round,
      overallRound: overall,
      overallRounds: 12,
      secondsLeft: left,
      totalSeconds: 1310,
    });
  });

  test('labels and done', () => {
    expect(deriveProgramPosition(MIXED, 400).blockLabel).toBe('Rounds');
    expect(deriveProgramPosition(MIXED, 400).roundsInBlock).toBe(3);
    expect(deriveProgramPosition(MIXED, 1310)).toEqual({
      phase: 'done',
      blockIndex: 2,
      blockLabel: 'Tabata',
      roundInBlock: 8,
      roundsInBlock: 8,
      overallRound: 12,
      overallRounds: 12,
      secondsLeft: 0,
      totalSeconds: 1310,
    });
    expect(deriveProgramPosition(MIXED, 99999).phase).toBe('done');
  });

  test('negative, fractional and non-finite elapsed', () => {
    expect(deriveProgramPosition(MIXED, -5)).toEqual(deriveProgramPosition(MIXED, 0));
    expect(deriveProgramPosition(MIXED, 299.9)).toEqual(deriveProgramPosition(MIXED, 299));
    expect(deriveProgramPosition(MIXED, NaN)).toEqual(deriveProgramPosition(MIXED, 0));
  });

  test('a zero rest between blocks is no period', () => {
    const program: WorkoutProgram = {
      version: 1,
      name: 'z',
      blocks: [
        { label: 'a', rounds: 2, workSeconds: 10, restSeconds: 0 },
        { label: 'b', rounds: 1, workSeconds: 5, restSeconds: 0 },
      ],
    };
    expect(deriveProgramPosition(program, 19)).toMatchObject({ phase: 'work', blockIndex: 0, secondsLeft: 1 });
    expect(deriveProgramPosition(program, 20)).toMatchObject({ phase: 'work', blockIndex: 1, secondsLeft: 5 });
    expect(deriveProgramPosition(program, 25).phase).toBe('done');
  });

  test('is pure: the program is not changed', () => {
    const before = JSON.stringify(MIXED);
    deriveProgramPosition(MIXED, 700);
    expect(JSON.stringify(MIXED)).toBe(before);
  });
});

describe('singleBlockProgram', () => {
  test('one block from the round timer settings', () => {
    expect(singleBlockProgram({ roundSeconds: 180, restSeconds: 60, roundsTotal: 3 })).toEqual({
      version: 1,
      name: 'Rounds',
      blocks: [{ label: '', rounds: 3, workSeconds: 180, restSeconds: 60 }],
    });
    expect(singleBlockProgram({ roundSeconds: 1, restSeconds: 0, roundsTotal: 1 }, 'Quick').name).toBe('Quick');
  });

  test('is JSON round-trippable and valid', () => {
    const program = singleBlockProgram({ roundSeconds: 180, restSeconds: 60, roundsTotal: 12 });
    expect(JSON.parse(JSON.stringify(program))).toEqual(program);
    expect(validateWorkoutProgram(program)).toEqual({ ok: true, program });
  });
});

describe('validateWorkoutProgram', () => {
  const block = { label: 'b', rounds: 1, workSeconds: 10, restSeconds: 0 };
  const program = (over: Record<string, unknown> = {}) => ({ version: 1, name: 'W', blocks: [block], ...over });
  const withBlock = (over: Record<string, unknown>) => program({ blocks: [{ ...block, ...over }] });
  const problems = (input: unknown) => {
    const result = validateWorkoutProgram(input);
    return result.ok ? [] : result.problems;
  };

  test('limits are the round timer limits', () => {
    expect(WORKOUT_PROGRAM_LIMITS.rounds).toBe(ROUND_TIMER_LIMITS.roundsTotal);
    expect(WORKOUT_PROGRAM_LIMITS.workSeconds).toBe(ROUND_TIMER_LIMITS.roundSeconds);
    expect(WORKOUT_PROGRAM_LIMITS.restSeconds).toBe(ROUND_TIMER_LIMITS.restSeconds);
  });

  test('accepts the mixed program and returns a copy', () => {
    const result = validateWorkoutProgram(MIXED);
    expect(result).toEqual({ ok: true, program: MIXED });
    if (result.ok) expect(result.program).not.toBe(MIXED);
  });

  test('trims, drops extra keys', () => {
    const result = validateWorkoutProgram({ ...program({ name: '  Pad  ', extra: 1 }), blocks: [{ ...block, label: ' x ', junk: true }] });
    expect(result).toEqual({ ok: true, program: { version: 1, name: 'Pad', blocks: [{ ...block, label: 'x' }] } });
  });

  test('name 1 to 60 after trim', () => {
    expect(problems(program({ name: 'a' }))).toEqual([]);
    expect(problems(program({ name: 'a'.repeat(60) }))).toEqual([]);
    expect(problems(program({ name: '' }))).toEqual(['PROGRAM_NAME_LENGTH']);
    expect(problems(program({ name: '   ' }))).toEqual(['PROGRAM_NAME_LENGTH']);
    expect(problems(program({ name: 'a'.repeat(61) }))).toEqual(['PROGRAM_NAME_LENGTH']);
  });

  test('label 0 to 40', () => {
    expect(problems(withBlock({ label: '' }))).toEqual([]);
    expect(problems(withBlock({ label: 'a'.repeat(40) }))).toEqual([]);
    expect(problems(withBlock({ label: 'a'.repeat(41) }))).toEqual(['BLOCK_LABEL_LENGTH:0']);
  });

  test('blocks 1 to 20', () => {
    expect(problems(program({ blocks: [] }))).toEqual(['PROGRAM_BLOCKS_COUNT']);
    expect(problems(program({ blocks: Array(20).fill(block) }))).toEqual([]);
    expect(problems(program({ blocks: Array(21).fill(block) }))).toEqual(['PROGRAM_BLOCKS_COUNT']);
  });

  test.each([
    ['rounds', 'BLOCK_ROUNDS_RANGE', 1, 100],
    ['workSeconds', 'BLOCK_WORK_RANGE', 1, 3600],
    ['restSeconds', 'BLOCK_REST_RANGE', 0, 3600],
  ] as const)('%s range at min-1, min, max, max+1', (key, code, min, max) => {
    expect(problems(withBlock({ [key]: min - 1 }))).toEqual([`${code}:0`]);
    expect(problems(withBlock({ [key]: min }))).toEqual([]);
    expect(problems(withBlock({ [key]: max, ...(key === 'workSeconds' ? { rounds: 1 } : {}) }))).toEqual([]);
    expect(problems(withBlock({ [key]: max + 1 }))).toEqual([`${code}:0`]);
    expect(problems(withBlock({ [key]: 1.5 }))).toEqual([`${code}:0`]);
  });

  test('whole program at most 14400 seconds', () => {
    const four = (work: number) => program({ blocks: [{ ...block, workSeconds: work, rounds: 4 }] });
    expect(problems(four(3600))).toEqual([]); // exactly 14400
    const long = program({ blocks: [{ ...block, workSeconds: 3600, rounds: 4 }, { ...block, workSeconds: 1, rounds: 1 }] });
    expect(problems(long)).toEqual(['PROGRAM_TOO_LONG']);
  });

  test('version', () => {
    expect(problems(program({ version: 2 }))).toEqual(['PROGRAM_VERSION']);
    expect(problems({ name: 'W', blocks: [block] })).toEqual(['PROGRAM_VERSION']);
  });

  test('sparse arrays: a hole is a bad block, not a skipped one', () => {
    const sparse = [block, block];
    delete (sparse as unknown[])[0];
    expect(validateWorkoutProgram(program({ blocks: sparse }))).toEqual({ ok: false, problems: ['BLOCK_SHAPE:0'] });
    expect(validateWorkoutProgram(program({ blocks: new Array(3) })).ok).toBe(false);
    expect(problems(program({ blocks: new Array(3) }))).toEqual(['BLOCK_SHAPE:0', 'BLOCK_SHAPE:1', 'BLOCK_SHAPE:2']);
  });

  test('never throws on odd input', () => {
    const hostile = { version: 1, name: 'x', get blocks(): unknown { throw new Error('boom'); } };
    const huge = program({ blocks: new Array(5_000_000).fill(block) });
    for (const input of [null, undefined, 5, 'x', [], [1], NaN, Infinity, {}, hostile, huge, program({ blocks: [null] }), program({ blocks: 'x' }), withBlock({ rounds: NaN }), withBlock({ workSeconds: Infinity }), withBlock({ label: 7 })]) {
      const result = validateWorkoutProgram(input);
      expect(result.ok).toBe(false);
    }
    expect(problems(huge)).toEqual(['PROGRAM_BLOCKS_COUNT']);
    expect(problems(null)).toEqual(['PROGRAM_SHAPE']);
    expect(problems(program({ blocks: [null] }))).toEqual(['BLOCK_SHAPE:0']);
  });
});

describe('optional stations', () => {
  const base = { version: 1, name: 'W', blocks: [{ label: 'b', rounds: 2, workSeconds: 10, restSeconds: 0 }] };
  const stations = { labels: [' Bag ', 'Rope', 'Pads'], groups: 2 };

  test('absent stays absent', () => {
    const result = validateWorkoutProgram(base);
    expect(result.ok && 'stations' in result.program).toBe(false);
  });

  test('present is validated, normalized and kept', () => {
    const result = validateWorkoutProgram({ ...base, stations: { ...stations, extra: 1 } });
    expect(result).toEqual({ ok: true, program: { ...base, stations: { labels: ['Bag', 'Rope', 'Pads'], groups: 2 } } });
  });

  test('station problems pass through with their codes', () => {
    expect(validateWorkoutProgram({ ...base, stations: { labels: ['a'], groups: 1 } })).toEqual({ ok: false, problems: ['STATIONS_COUNT'] });
    expect(validateWorkoutProgram({ ...base, stations: { ...stations, groups: 4 } })).toEqual({ ok: false, problems: ['STATIONS_GROUPS'] });
    expect(validateWorkoutProgram({ ...base, stations: null })).toEqual({ ok: false, problems: ['STATIONS_SHAPE'] });
    expect(validateWorkoutProgram({ ...base, name: '', stations: 'x' })).toEqual({ ok: false, problems: ['PROGRAM_NAME_LENGTH', 'STATIONS_SHAPE'] });
  });
});
