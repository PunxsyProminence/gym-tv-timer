// Stations (circuits): groups rotate through labelled stations, one move per round.
//
// Pure and browser-safe: no storage, UI, framework, network, timers, clock or randomness. A host
// keeps the setup inside the saved program (workoutPrograms.ts) and asks this module which station
// each group is at in a given round, so the TV can show who is where and call "switch".

export interface StationSetup {
  labels: string[];
  groups: number;
}

export const STATION_LIMITS = {
  stations: { min: 2, max: 20 },
  label: { min: 1, max: 40 },
  /** Groups run from this to the number of stations. */
  groupsMin: 1,
} as const;

export interface StationAssignment {
  group: number;
  /** 0-based index into labels. */
  stationIndex: number;
  label: string;
}

/**
 * Where each group stands in `overallRound` (1-based, across the whole program). One move per round:
 * group g is at station index (g - 1 + r - 1) mod labels.length. Rounds below 1 are read as round 1.
 */
export function stationBoard(setup: StationSetup, overallRound: number): StationAssignment[] {
  const count = setup.labels.length;
  if (count === 0) return [];
  const round = Number.isFinite(overallRound) ? Math.max(1, Math.floor(overallRound)) : 1;
  const board: StationAssignment[] = [];
  for (let group = 1; group <= setup.groups; group += 1) {
    const stationIndex = (group - 1 + round - 1) % count;
    board.push({ group, stationIndex, label: setup.labels[stationIndex] });
  }
  return board;
}

export type StationsValidation = { ok: true; stations: StationSetup } | { ok: false; problems: string[] };

// Problem codes are stable strings:
//   STATIONS_SHAPE, STATIONS_COUNT, STATIONS_GROUPS, STATION_SHAPE:i, STATION_LABEL_LENGTH:i
// where i is the label's 0-based index.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks anything and never throws. Returns a normalized copy: labels trimmed, extra keys dropped. */
export function validateStations(input: unknown): StationsValidation {
  try {
    return validate(input);
  } catch {
    return { ok: false, problems: ['STATIONS_SHAPE'] };
  }
}

function validate(input: unknown): StationsValidation {
  if (!isRecord(input)) return { ok: false, problems: ['STATIONS_SHAPE'] };
  const problems: string[] = [];
  const labels: string[] = [];
  let count: number = STATION_LIMITS.stations.max;

  if (!Array.isArray(input.labels)) {
    problems.push('STATIONS_SHAPE');
  } else if (
    input.labels.length < STATION_LIMITS.stations.min
    || input.labels.length > STATION_LIMITS.stations.max
  ) {
    problems.push('STATIONS_COUNT'); // length checked before walking
  } else {
    count = input.labels.length;
    // Indexed loop, not forEach: forEach skips holes in a sparse array, which would drop stations.
    for (let i = 0; i < input.labels.length; i += 1) {
      const raw: unknown = input.labels[i];
      if (typeof raw !== 'string') {
        problems.push(`STATION_SHAPE:${i}`);
        continue;
      }
      const label = raw.trim();
      if (label.length < STATION_LIMITS.label.min || label.length > STATION_LIMITS.label.max) {
        problems.push(`STATION_LABEL_LENGTH:${i}`);
        continue;
      }
      labels.push(label);
    }
  }

  const groups = input.groups;
  if (typeof groups !== 'number' || !Number.isInteger(groups) || groups < STATION_LIMITS.groupsMin || groups > count) {
    problems.push('STATIONS_GROUPS');
  }

  if (problems.length === 0) return { ok: true, stations: { labels, groups: groups as number } };
  return { ok: false, problems };
}
