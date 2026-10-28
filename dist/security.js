"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_SCRYPT_COST = void 0;
exports.hashPin = hashPin;
exports.verifyPin = verifyPin;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.readBootstrapKeyHeader = readBootstrapKeyHeader;
exports.bootstrapKeyMatches = bootstrapKeyMatches;
exports.createOpaqueToken = createOpaqueToken;
exports.hashToken = hashToken;
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const scrypt = (0, node_util_1.promisify)(node_crypto_1.scrypt);
async function hashPin(pin) {
    const normalized = pin.trim();
    if (!normalized) {
        throw new Error('PIN is required');
    }
    const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const derived = (await scrypt(normalized, salt, 64));
    return `scrypt$${salt}$${derived.toString('hex')}`;
}
async function verifyPin(pin, encodedHash) {
    const parts = encodedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
    }
    const [, salt, storedHex] = parts;
    const derived = (await scrypt(pin.trim(), salt, 64));
    const stored = Buffer.from(storedHex, 'hex');
    if (derived.length !== stored.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(derived, stored);
}
/**
 * scrypt cost for a password. The numbers are written into every stored hash,
 * so raising one here changes new hashes only and old ones still verify.
 *
 * N is double hashPin's (Node's default 2^14): a starting point, open to the
 * architect's review. One hash needs about 128 * N * r bytes (33 MB here),
 * which is over node:crypto's default 32 MB ceiling -- hence maxmem below.
 */
exports.PASSWORD_SCRYPT_COST = { N: 2 ** 15, r: 8, p: 1 };
/**
 * The costs verifyPassword will derive at: hashPin's N up to four times the
 * current one, at the r and p every hash written here carries. A stored cost
 * outside that was not written by this code, and deriving at whatever a row
 * claims is how one bad row costs gigabytes and seconds. Raise the ceiling in
 * the same change that raises PASSWORD_SCRYPT_COST past it.
 */
const MIN_STORED_SCRYPT_N = 2 ** 14;
const MAX_STORED_SCRYPT_N = 2 ** 17;
function scryptOptions(cost) {
    return { ...cost, maxmem: 256 * cost.N * cost.r };
}
// promisify picks scrypt's three-argument overload; this is the four-argument
// one, still the asynchronous form (libuv's thread pool, not the request thread).
function scryptWithCost(secret, salt, cost) {
    return new Promise((resolve, reject) => {
        (0, node_crypto_1.scrypt)(secret, salt, 64, scryptOptions(cost), (error, derived) => (error ? reject(error) : resolve(derived)));
    });
}
/** One spelling per password: a composed and a decomposed "é" are the same key. */
function normalizePassword(password) {
    return password.normalize('NFKC');
}
/**
 * Hashes a password a person chose. Stored as scrypt$N$r$p$salt$hex.
 *
 * Not hashPin: a PIN is trimmed and a password is not (a leading or trailing
 * space is part of what the person typed), and the two formats do not verify
 * as each other, so a PIN hash can never be accepted as a password.
 */
async function hashPassword(password) {
    const normalized = normalizePassword(password);
    if (!normalized) {
        throw new Error('Password is required');
    }
    const { N, r, p } = exports.PASSWORD_SCRYPT_COST;
    const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const derived = await scryptWithCost(normalized, salt, exports.PASSWORD_SCRYPT_COST);
    return `scrypt$${N}$${r}$${p}$${salt}$${derived.toString('hex')}`;
}
async function verifyPassword(password, encodedHash) {
    const parts = encodedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
        return false;
    }
    const [, rawN, rawR, rawP, salt, storedHex] = parts;
    const cost = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
    const costIsSane = Number.isInteger(cost.N) && cost.N >= MIN_STORED_SCRYPT_N && cost.N <= MAX_STORED_SCRYPT_N
        && (cost.N & (cost.N - 1)) === 0
        && cost.r === exports.PASSWORD_SCRYPT_COST.r
        && cost.p === exports.PASSWORD_SCRYPT_COST.p;
    if (!costIsSane || !salt || !storedHex) {
        return false;
    }
    let derived;
    try {
        derived = await scryptWithCost(normalizePassword(password), salt, cost);
    }
    catch {
        // A derivation that cannot run (memory refused) is "does not verify",
        // never an exception out of a sign-in path.
        return false;
    }
    const stored = Buffer.from(storedHex, 'hex');
    if (derived.length !== stored.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(derived, stored);
}
// Both header names are in live use -- the admin bootstrap/migration routes
// and their deploy tooling send x-ppbf-bootstrap-key, the SHADOW job drain
// sends x-bootstrap-key -- so both must keep being accepted.
const BOOTSTRAP_KEY_HEADERS = ['x-ppbf-bootstrap-key', 'x-bootstrap-key'];
function readBootstrapKeyHeader(headers) {
    for (const header of BOOTSTRAP_KEY_HEADERS) {
        const value = headers.get(header)?.trim();
        if (value) {
            return value;
        }
    }
    return '';
}
// Compares the operator key in constant time: a length-independent byte
// comparison would leak the expected key one character at a time to a caller
// that can time the response.
function bootstrapKeyMatches(headers, expectedKey) {
    const provided = readBootstrapKeyHeader(headers);
    const expected = expectedKey?.trim() || '';
    if (!provided || !expected) {
        return false;
    }
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(providedBuffer, expectedBuffer);
}
function createOpaqueToken() {
    return (0, node_crypto_1.randomBytes)(32).toString('hex');
}
function hashToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
