export interface StationSetup {
    labels: string[];
    groups: number;
}
export declare const STATION_LIMITS: {
    readonly stations: {
        readonly min: 2;
        readonly max: 20;
    };
    readonly label: {
        readonly min: 1;
        readonly max: 40;
    };
    /** Groups run from this to the number of stations. */
    readonly groupsMin: 1;
};
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
export declare function stationBoard(setup: StationSetup, overallRound: number): StationAssignment[];
export type StationsValidation = {
    ok: true;
    stations: StationSetup;
} | {
    ok: false;
    problems: string[];
};
/** Checks anything and never throws. Returns a normalized copy: labels trimmed, extra keys dropped. */
export declare function validateStations(input: unknown): StationsValidation;
