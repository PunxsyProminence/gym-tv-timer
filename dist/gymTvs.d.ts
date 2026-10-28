import { PilotError } from './errors';
export declare const PAIR_CODE_LENGTH = 6;
export declare const PAIR_CODE_LIFETIME_MS: number;
export declare const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export declare const PAIR_CODE_MINT_LIMIT = 5;
export declare const PAIR_CODE_MINT_WINDOW_MS: number;
export declare const TV_NAME_MAX_LENGTH = 60;
export declare class GymTvError extends PilotError {
    constructor(status: number, code: string);
}
export declare function normalizePairCode(raw: string): string;
export declare function isWellFormedPairCode(code: string): boolean;
export declare function newPairCode(): string;
export declare function validateTvName(raw: unknown): string;
