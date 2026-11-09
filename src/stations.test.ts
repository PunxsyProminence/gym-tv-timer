import { STATION_LIMITS, stationBoard, validateStations, type StationSetup } from './stations';

const labels = (n: number): string[] => Array.from({ length: n }, (_, i) => `S${i + 1}`);
const problems = (input: unknown): string[] => {
  const result = validateStations(input);
  return result.ok ? [] : result.problems;
};

describe('stationBoard', () => {
  const setup: StationSetup = { labels: ['Bag', 'Rope', 'Pads', 'Core'], groups: 4 };

  test('round 1: group g at station g', () => {
    expect(stationBoard(setup, 1).map((a) => [a.group, a.stationIndex, a.label])).toEqual([
      [1, 0, 'Bag'], [2, 1, 'Rope'], [3, 2, 'Pads'], [4, 3, 'Core'],
    ]);
  });

  test('one move per round, wrapping', () => {
    expect(stationBoard(setup, 2).map((a) => a.label)).toEqual(['Rope', 'Pads', 'Core', 'Bag']);
    expect(stationBoard(setup, 4).map((a) => a.label)).toEqual(['Core', 'Bag', 'Rope', 'Pads']);
    expect(stationBoard(setup, 5)).toEqual(stationBoard(setup, 1));
  });

  test('every group visits every station over a full cycle', () => {
    for (let group = 1; group <= 4; group += 1) {
      const seen = new Set<number>();
      for (let r = 1; r <= 4; r += 1) seen.add(stationBoard(setup, r)[group - 1].stationIndex);
      expect(seen.size).toBe(4);
    }
  });

  test('fewer groups than stations: some stations are empty', () => {
    const few: StationSetup = { labels: ['A', 'B', 'C', 'D', 'E'], groups: 2 };
    expect(stationBoard(few, 1).map((a) => a.label)).toEqual(['A', 'B']);
    expect(stationBoard(few, 4).map((a) => a.label)).toEqual(['D', 'E']);
    expect(stationBoard(few, 5).map((a) => a.label)).toEqual(['E', 'A']);
  });

  test('odd rounds are read as round 1; empty labels give no board', () => {
    expect(stationBoard(setup, 0)).toEqual(stationBoard(setup, 1));
    expect(stationBoard(setup, -3)).toEqual(stationBoard(setup, 1));
    expect(stationBoard(setup, NaN)).toEqual(stationBoard(setup, 1));
    expect(stationBoard(setup, 2.9)).toEqual(stationBoard(setup, 2));
    expect(stationBoard({ labels: [], groups: 3 }, 1)).toEqual([]);
  });
});

describe('validateStations', () => {
  test('normalizes: trims labels, drops extra keys', () => {
    expect(validateStations({ labels: [' Bag ', 'Rope'], groups: 2, extra: 1 })).toEqual({
      ok: true,
      stations: { labels: ['Bag', 'Rope'], groups: 2 },
    });
  });

  test('station count limits', () => {
    expect(problems({ labels: labels(2), groups: 1 })).toEqual([]);
    expect(problems({ labels: labels(20), groups: 20 })).toEqual([]);
    expect(problems({ labels: labels(1), groups: 1 })).toEqual(['STATIONS_COUNT']);
    expect(problems({ labels: labels(21), groups: 1 })).toEqual(['STATIONS_COUNT']);
    expect(problems({ labels: [], groups: 1 })).toEqual(['STATIONS_COUNT']);
  });

  test('label length limits after trim', () => {
    expect(problems({ labels: ['a', 'b'], groups: 1 })).toEqual([]);
    expect(problems({ labels: ['a'.repeat(40), 'b'], groups: 1 })).toEqual([]);
    expect(problems({ labels: ['a'.repeat(41), 'b'], groups: 1 })).toEqual(['STATION_LABEL_LENGTH:0']);
    expect(problems({ labels: ['a', '   '], groups: 1 })).toEqual(['STATION_LABEL_LENGTH:1']);
    expect(problems({ labels: ['', ' x '], groups: 1 })).toEqual(['STATION_LABEL_LENGTH:0']);
    expect(problems({ labels: [` ${'a'.repeat(40)} `, 'b'], groups: 1 })).toEqual([]);
  });

  test('groups limits: 1 to the number of stations, integers only', () => {
    const base = labels(4);
    expect(problems({ labels: base, groups: 1 })).toEqual([]);
    expect(problems({ labels: base, groups: 4 })).toEqual([]);
    for (const groups of [0, 5, -1, 1.5, NaN, Infinity, '2', null, undefined]) {
      expect(problems({ labels: base, groups })).toEqual(['STATIONS_GROUPS']);
    }
  });

  test('sparse arrays: a hole is a bad station, not a skipped one', () => {
    const sparse = labels(3);
    delete (sparse as unknown[])[1];
    expect(problems({ labels: sparse, groups: 1 })).toEqual(['STATION_SHAPE:1']);
    expect(problems({ labels: new Array(3), groups: 1 })).toEqual(['STATION_SHAPE:0', 'STATION_SHAPE:1', 'STATION_SHAPE:2']);
  });

  test('odd input never throws', () => {
    const hostile = { groups: 1, get labels(): unknown { throw new Error('boom'); } };
    const huge = { labels: new Array(5_000_000).fill('x'), groups: 1 };
    for (const input of [null, undefined, 5, 'x', [], [1], NaN, {}, hostile, huge, { labels: 'x', groups: 1 }, { labels: [1, 2], groups: 1 }]) {
      expect(validateStations(input).ok).toBe(false);
    }
    expect(problems(null)).toEqual(['STATIONS_SHAPE']);
    expect(problems([])).toEqual(['STATIONS_SHAPE']);
    expect(problems(hostile)).toEqual(['STATIONS_SHAPE']);
    expect(problems(huge)).toEqual(['STATIONS_COUNT']);
    expect(problems({ labels: 'x', groups: 1 })).toEqual(['STATIONS_SHAPE']);
    expect(problems({ labels: [1, 2], groups: 1 })).toEqual(['STATION_SHAPE:0', 'STATION_SHAPE:1']);
  });

  test('limits are the documented ones', () => {
    expect(STATION_LIMITS.stations).toEqual({ min: 2, max: 20 });
    expect(STATION_LIMITS.label).toEqual({ min: 1, max: 40 });
  });
});
