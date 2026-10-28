// NEW in gym-tv-timer (not ported): ppbf-platform has no pure tests for the pairing functions; its
// gymTvs.pg.test.ts exercises them only through the database. Pure: no database here.

import { PilotError } from './errors';
import {
  GymTvError,
  PAIR_CODE_ALPHABET,
  PAIR_CODE_LENGTH,
  PAIR_CODE_LIFETIME_MS,
  PAIR_CODE_MINT_LIMIT,
  PAIR_CODE_MINT_WINDOW_MS,
  TV_NAME_MAX_LENGTH,
  isWellFormedPairCode,
  newPairCode,
  normalizePairCode,
  validateTvName,
} from './gymTvs';

describe('the pairing numbers', () => {
  test('a 6-character code that lives five minutes, five mints per coach per ten minutes', () => {
    expect(PAIR_CODE_LENGTH).toBe(6);
    expect(PAIR_CODE_LIFETIME_MS).toBe(5 * 60 * 1000);
    expect(PAIR_CODE_MINT_LIMIT).toBe(5);
    expect(PAIR_CODE_MINT_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(TV_NAME_MAX_LENGTH).toBe(60);
  });

  test('the alphabet is 32 distinct characters with no 0, O, 1 or I', () => {
    expect(PAIR_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(PAIR_CODE_ALPHABET).size).toBe(32);
    for (const ch of ['0', 'O', '1', 'I']) expect(PAIR_CODE_ALPHABET).not.toContain(ch);
  });
});

describe('normalizePairCode', () => {
  test('upper-cases and drops everything but letters and digits', () => {
    expect(normalizePairCode(' ab-c 2 3 4 ')).toBe('ABC234');
    expect(normalizePairCode('x7k.9p_q')).toBe('X7K9PQ');
  });

  test('does not remove the look-alike characters: that is isWellFormedPairCode', () => {
    expect(normalizePairCode('o0i1')).toBe('O0I1');
  });
});

describe('isWellFormedPairCode', () => {
  test('six characters of the alphabet', () => {
    expect(isWellFormedPairCode('ABC234')).toBe(true);
    expect(isWellFormedPairCode('ZZ9988')).toBe(true);
  });

  test.each([
    ['too short', 'ABC23'],
    ['too long', 'ABC2345'],
    ['empty', ''],
    ['a zero', 'ABC230'],
    ['a letter O', 'ABC23O'],
    ['a one', 'ABC231'],
    ['a letter I', 'ABC23I'],
    ['lower case (not normalized)', 'abc234'],
    ['a separator (not normalized)', 'ABC-23'],
  ])('refuses %s', (_label, code) => {
    expect(isWellFormedPairCode(code)).toBe(false);
  });

  test('a typed code is well formed once normalized', () => {
    expect(isWellFormedPairCode(normalizePairCode(' abc-234 '))).toBe(true);
  });
});

describe('newPairCode', () => {
  test('every code is well formed', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = newPairCode();
      expect(code).toHaveLength(PAIR_CODE_LENGTH);
      expect(isWellFormedPairCode(code)).toBe(true);
    }
  });

  test('draws from the whole alphabet, not the same code every time', () => {
    const codes = Array.from({ length: 2000 }, () => newPairCode());
    expect(new Set(codes).size).toBeGreaterThan(1990);
    // 12,000 draws over 32 characters: a character never drawn would mean a broken draw.
    expect(new Set(codes.join('')).size).toBe(32);
  });
});

describe('validateTvName', () => {
  function refusal(raw: unknown): GymTvError {
    try {
      validateTvName(raw);
    } catch (error) {
      if (error instanceof GymTvError) return error;
      throw error;
    }
    throw new Error('expected a refusal');
  }

  test('returns the name trimmed', () => {
    expect(validateTvName('  Gym main ')).toBe('Gym main');
    expect(validateTvName('House')).toBe('House');
  });

  test('accepts exactly the longest name, counted after trimming', () => {
    const longest = 'x'.repeat(TV_NAME_MAX_LENGTH);
    expect(validateTvName(longest)).toBe(longest);
    expect(validateTvName(`  ${longest}  `)).toBe(longest);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an array', ['Gym main']],
    ['an object', { name: 'Gym main' }],
  ])('refuses %s as TV_NAME_REQUIRED', (_label, raw) => {
    expect(refusal(raw)).toMatchObject({ status: 400, code: 'TV_NAME_REQUIRED', message: 'TV_NAME_REQUIRED' });
  });

  test.each([
    ['empty', ''],
    ['only spaces', '    '],
    ['one past the longest', 'x'.repeat(TV_NAME_MAX_LENGTH + 1)],
  ])('refuses a name that is %s as TV_NAME_LENGTH', (_label, raw) => {
    expect(refusal(raw)).toMatchObject({ status: 400, code: 'TV_NAME_LENGTH', message: 'TV_NAME_LENGTH' });
  });

  test('the refusal is a PilotError named GymTvError', () => {
    const error = refusal('');
    expect(error).toBeInstanceOf(PilotError);
    expect(error.name).toBe('GymTvError');
  });
});
