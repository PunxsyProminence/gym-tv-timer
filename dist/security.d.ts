export declare function hashPin(pin: string): Promise<string>;
export declare function verifyPin(pin: string, encodedHash: string): Promise<boolean>;
/**
 * scrypt cost for a password. The numbers are written into every stored hash,
 * so raising one here changes new hashes only and old ones still verify.
 *
 * N is double hashPin's (Node's default 2^14): a starting point, open to the
 * architect's review. One hash needs about 128 * N * r bytes (33 MB here),
 * which is over node:crypto's default 32 MB ceiling -- hence maxmem below.
 */
export declare const PASSWORD_SCRYPT_COST: {
    readonly N: number;
    readonly r: 8;
    readonly p: 1;
};
/**
 * Hashes a password a person chose. Stored as scrypt$N$r$p$salt$hex.
 *
 * Not hashPin: a PIN is trimmed and a password is not (a leading or trailing
 * space is part of what the person typed), and the two formats do not verify
 * as each other, so a PIN hash can never be accepted as a password.
 */
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, encodedHash: string): Promise<boolean>;
export declare function readBootstrapKeyHeader(headers: Headers): string;
export declare function bootstrapKeyMatches(headers: Headers, expectedKey: string | undefined): boolean;
export declare function createOpaqueToken(): string;
export declare function hashToken(token: string): string;
