import { deriveRoundTimer, type RoundTimerSettings } from './roundTimers';
import { advanceRoundTimer, roundSounds, type WallRoundReading } from './wallRoundTimer';
import { CUE_WORDS, DEFAULT_CUE_SETTINGS, cueSchedule, type Cue, type CueSettings } from './workoutCues';
import { programTotalSeconds, singleBlockProgram, type WorkoutProgram } from './workoutPrograms';

const START = '2026-10-12T18:00:00.000Z';
const ALL_OFF: CueSettings = { endSound: 'bell', knock: false, voiceCountdown: false, lastRoundCall: false, switchCall: false };
const rounds = (roundSeconds: number, restSeconds: number, roundsTotal: number): WorkoutProgram =>
  singleBlockProgram({ roundSeconds, restSeconds, roundsTotal });
const at = (cues: Cue[], what: Cue['what']): number[] => cues.filter((c) => c.what === what).map((c) => c.atSecond);
const spoken = (cues: Cue[]): Array<[number, string | undefined]> =>
  cues.filter((c) => c.sound === 'voice').map((c) => [c.atSecond, c.words]);

describe('equivalence with wallRoundTimer roundSounds (default settings)', () => {
  const grid: RoundTimerSettings[] = [
    { roundSeconds: 180, restSeconds: 60, roundsTotal: 3 },
    { roundSeconds: 180, restSeconds: 0, roundsTotal: 3 },
    { roundSeconds: 20, restSeconds: 10, roundsTotal: 8 },
    { roundSeconds: 1, restSeconds: 0, roundsTotal: 1 },
    { roundSeconds: 10, restSeconds: 5, roundsTotal: 2 },
    { roundSeconds: 11, restSeconds: 0, roundsTotal: 3 },
    { roundSeconds: 5, restSeconds: 7, roundsTotal: 1 },
    { roundSeconds: 3, restSeconds: 1, roundsTotal: 6 },
    { roundSeconds: 30, restSeconds: 1, roundsTotal: 1 },
    { roundSeconds: 12, restSeconds: 3, roundsTotal: 4 },
  ];

  test.each(grid)('%j rings what the TV rings', (settings) => {
    const program = singleBlockProgram(settings);
    const total = programTotalSeconds(program);
    const config = { round_seconds: settings.roundSeconds, rest_seconds: settings.restSeconds };
    const view = deriveRoundTimer({
      round_seconds: settings.roundSeconds,
      rest_seconds: settings.restSeconds,
      rounds_total: settings.roundsTotal,
      state: 'running',
      started_at: START,
      paused_at: null,
      paused_seconds: 0,
      server_time: START,
    });
    let prev: WallRoundReading = { state: 'ready', phase: 'ready', round: 0, rounds_total: settings.roundsTotal, seconds_left: 0 };
    const tv: Array<[number, string]> = [];
    for (let e = 0; e <= total + 5; e += 1) {
      const reading = advanceRoundTimer(view, e);
      for (const sound of roundSounds('set', prev, reading, config, 7)) {
        if (sound.voice === 'knock') {
          tv.push([e, 'knock']);
        } else {
          const ends = sound.keys.some((k) => k.endsWith(':end'));
          const starts = sound.keys.some((k) => k.endsWith(':start'));
          tv.push([e, ends && starts ? 'round_end_start' : ends ? 'round_end' : 'round_start']);
        }
      }
      prev = reading;
    }
    const mine = cueSchedule(program, DEFAULT_CUE_SETTINGS).map((c): [number, string] => [c.atSecond, c.what]);
    expect(mine).toEqual(tv);
    expect(tv.length).toBeGreaterThan(0);
  });
});

describe('cueSchedule bell and buzzer', () => {
  test('180/60 x 3: start and end of every round, sorted', () => {
    const cues = cueSchedule(rounds(180, 60, 3), ALL_OFF);
    expect(cues.map((c) => [c.atSecond, c.what, c.overallRound])).toEqual([
      [0, 'round_start', 1], [180, 'round_end', 1],
      [240, 'round_start', 2], [420, 'round_end', 2],
      [480, 'round_start', 3], [660, 'round_end', 3],
    ]);
    expect(cues.every((c) => c.sound === 'bell' && c.words === undefined)).toBe(true);
  });

  test('rest 0: one strike where a round ends and the next starts', () => {
    const cues = cueSchedule(rounds(60, 0, 3), ALL_OFF);
    expect(cues.map((c) => [c.atSecond, c.what, c.overallRound])).toEqual([
      [0, 'round_start', 1], [60, 'round_end_start', 2], [120, 'round_end_start', 3], [180, 'round_end', 3],
    ]);
  });

  test('buzzer replaces the bell for round cues only', () => {
    const cues = cueSchedule(rounds(30, 10, 2), { ...DEFAULT_CUE_SETTINGS, endSound: 'buzzer' });
    expect(cues.filter((c) => c.what.startsWith('round_')).every((c) => c.sound === 'buzzer')).toBe(true);
    expect(cues.find((c) => c.what === 'knock')?.sound).toBe('knock');
  });

  test('one round: work start and end only', () => {
    expect(cueSchedule(rounds(5, 30, 1), ALL_OFF).map((c) => [c.atSecond, c.what])).toEqual([[0, 'round_start'], [5, 'round_end']]);
  });
});

describe('cueSchedule knock', () => {
  test('at 10 s left in work periods longer than 10 s', () => {
    expect(at(cueSchedule(rounds(180, 60, 3), DEFAULT_CUE_SETTINGS), 'knock')).toEqual([170, 410, 650]);
  });

  test('not for work of 10 s or less, or when off', () => {
    expect(at(cueSchedule(rounds(10, 5, 3), DEFAULT_CUE_SETTINGS), 'knock')).toEqual([]);
    expect(at(cueSchedule(rounds(11, 5, 1), DEFAULT_CUE_SETTINGS), 'knock')).toEqual([1]);
    expect(at(cueSchedule(rounds(180, 60, 3), ALL_OFF), 'knock')).toEqual([]);
  });
});

describe('cueSchedule voice countdown', () => {
  const voiceOnly: CueSettings = { ...ALL_OFF, voiceCountdown: true };

  test('"10 seconds" in work longer than 10 s; 3, 2, 1 in rest longer than 3 s', () => {
    expect(spoken(cueSchedule(rounds(20, 10, 2), voiceOnly))).toEqual([
      [10, '10 seconds'], [27, '3'], [28, '2'], [29, '1'], [40, '10 seconds'],
    ]);
  });

  test('short periods get no call', () => {
    expect(spoken(cueSchedule(rounds(10, 3, 3), voiceOnly))).toEqual([]);
    expect(spoken(cueSchedule(rounds(11, 4, 2), voiceOnly))).toEqual([
      [1, '10 seconds'], [12, '3'], [13, '2'], [14, '1'], [16, '10 seconds'],
    ]);
  });

  test('off by default', () => {
    expect(spoken(cueSchedule(rounds(20, 10, 2), DEFAULT_CUE_SETTINGS))).toEqual([]);
  });

  test('words come from CUE_WORDS', () => {
    expect(CUE_WORDS).toEqual({ tenSeconds: '10 seconds', lastRound: 'last round', switch: 'switch', countdown: ['3', '2', '1'] });
  });
});

describe('cueSchedule last-round and switch calls', () => {
  const calls: CueSettings = { ...ALL_OFF, lastRoundCall: true, switchCall: true };

  test('"switch" at every work end but the last; "last round" at the last round start', () => {
    const cues = cueSchedule(rounds(60, 20, 3), calls).filter((c) => c.sound === 'voice');
    expect(cues.map((c) => [c.atSecond, c.words, c.overallRound])).toEqual([
      [60, 'switch', 1], [140, 'switch', 2], [160, 'last round', 3],
    ]);
  });

  test('a one-round program has neither call', () => {
    expect(cueSchedule(rounds(60, 20, 1), calls).filter((c) => c.sound === 'voice')).toEqual([]);
  });

  test('rest 0: switch then last round in the same second, after the bell', () => {
    const cues = cueSchedule(rounds(30, 0, 2), calls).filter((c) => c.atSecond === 30);
    expect(cues.map((c) => c.what)).toEqual(['round_end_start', 'switch', 'last_round']);
  });

  test('each flag alone', () => {
    const switchOnly = cueSchedule(rounds(60, 20, 3), { ...ALL_OFF, switchCall: true });
    expect(spoken(switchOnly)).toEqual([[60, 'switch'], [140, 'switch']]);
    const lastOnly = cueSchedule(rounds(60, 20, 3), { ...ALL_OFF, lastRoundCall: true });
    expect(spoken(lastOnly)).toEqual([[160, 'last round']]);
  });
});

describe('cueSchedule mixed program', () => {
  // 0-30 work r1; 30-45 rest; 45-65 r2; 65-85 r3 (rest 0); 85-93 r4; 93-97 rest; 97-105 r5.
  const MIXED: WorkoutProgram = {
    version: 1,
    name: 'Mixed',
    blocks: [
      { label: 'Warm-up', rounds: 1, workSeconds: 30, restSeconds: 15 },
      { label: 'Rounds', rounds: 2, workSeconds: 20, restSeconds: 0 },
      { label: 'Tabata', rounds: 2, workSeconds: 8, restSeconds: 4 },
    ],
  };
  const everything: CueSettings = { endSound: 'buzzer', knock: true, voiceCountdown: true, lastRoundCall: true, switchCall: true };

  test('round cues follow the program across blocks', () => {
    expect(cueSchedule(MIXED, ALL_OFF).map((c) => [c.atSecond, c.what, c.overallRound])).toEqual([
      [0, 'round_start', 1], [30, 'round_end', 1],
      [45, 'round_start', 2], [65, 'round_end_start', 3], [85, 'round_end_start', 4],
      [93, 'round_end', 4], [97, 'round_start', 5], [105, 'round_end', 5],
    ]);
  });

  test('every setting on: knock and voice at the right seconds', () => {
    const cues = cueSchedule(MIXED, everything);
    expect(at(cues, 'knock')).toEqual([20, 55, 75]);
    expect(spoken(cues)).toEqual([
      [20, '10 seconds'], [30, 'switch'], [42, '3'], [43, '2'], [44, '1'],
      [55, '10 seconds'], [65, 'switch'], [75, '10 seconds'], [85, 'switch'],
      [93, 'switch'], [94, '3'], [95, '2'], [96, '1'], [97, 'last round'],
    ]);
  });

  test('sorted by second, with a fixed order inside a second', () => {
    const cues = cueSchedule(MIXED, everything);
    const rank = { bell: 0, buzzer: 0, knock: 1, voice: 2 } as const;
    for (let i = 1; i < cues.length; i += 1) {
      expect(cues[i].atSecond).toBeGreaterThanOrEqual(cues[i - 1].atSecond);
      if (cues[i].atSecond === cues[i - 1].atSecond) expect(rank[cues[i].sound]).toBeGreaterThanOrEqual(rank[cues[i - 1].sound]);
    }
    expect(cues.filter((c) => c.atSecond === 20).map((c) => c.sound)).toEqual(['knock', 'voice']);
  });
});

describe('cueSchedule edge cases', () => {
  test('an empty program has no cues', () => {
    expect(cueSchedule({ version: 1, name: 'x', blocks: [] }, DEFAULT_CUE_SETTINGS)).toEqual([]);
  });
});
