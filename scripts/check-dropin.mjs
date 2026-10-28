// Proves the package drops into a host the way ppbf-platform consumes code, before ppbf touches it.
//
//   node scripts/check-dropin.mjs                    this checkout, packed (what CI runs)
//   node scripts/check-dropin.mjs github:OWNER/REPO#<full sha>
//                                                    the spec ppbf-platform will put in package.json
//
// It installs the spec into a throwaway project and checks:
//   1. the installed files are dist/ and sounds/ only (no source, tests or config), and the bell's
//      sha256 is the one CREDITS.txt records;
//   2. every subpath loads with require() and exports the same names as this checkout's dist/;
//   3. the browser-safe subpaths pull in no Node module: ppbf's client components (WallDisplay.tsx,
//      RoundTimerControls.tsx) import roundTimers, wallRoundTimer and gymSayings, and a node: require
//      there would land in the browser bundle;
//   4. the types resolve under both of ppbf's TypeScript settings: apps/web/tsconfig.json
//      ("bundler", what tsc and Next use) and apps/web/jest.config.js's ts-jest override
//      (module commonjs, moduleResolution "node", which reads typesVersions, not exports);
//   5. a test that imports every subpath passes under ts-jest configured the way ppbf's is.
// It does not run Next. A Next build with the package is the plug-back step's to prove.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootRequire = createRequire(path.join(root, 'package.json'));
const MODULES = ['roundTimers', 'wallRoundTimer', 'gymSayings', 'errors', 'gymTvs', 'security'];
const BROWSER_SAFE = ['roundTimers', 'wallRoundTimer', 'gymSayings', 'errors'];

const problems = [];
function fail(message) {
  problems.push(message);
  console.error(`FAIL ${message}`);
}
function pass(message) {
  console.log(`ok   ${message}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function filesUnder(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-tv-timer-dropin-'));
try {
  let spec = process.argv[2];
  if (!spec) {
    const packed = run('npm', ['pack', '--json', '--pack-destination', work], root);
    if (packed.status !== 0) throw new Error(`npm pack failed:\n${packed.out}`);
    const json = packed.out.slice(packed.out.indexOf('['));
    spec = path.join(work, JSON.parse(json)[0].filename);
  }
  console.log(`spec ${spec}`);

  const consumer = path.join(work, 'consumer');
  fs.mkdirSync(path.join(consumer, 'src'), { recursive: true });
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'dropin-consumer',
    private: true,
    dependencies: { 'gym-tv-timer': spec },
  }, null, 2));
  const installed = run('npm', ['install', '--no-audit', '--no-fund'], consumer);
  if (installed.status !== 0) throw new Error(`npm install failed:\n${installed.out}`);
  const pkgDir = path.join(consumer, 'node_modules', 'gym-tv-timer');

  // 1. What was installed.
  const files = filesUnder(pkgDir).sort();
  const expected = [
    'README.md',
    'package.json',
    'sounds/CREDITS.txt',
    'sounds/boxing-bell.wav',
    ...MODULES.flatMap((m) => [`dist/${m}.d.ts`, `dist/${m}.js`]),
  ].sort();
  if (JSON.stringify(files) === JSON.stringify(expected)) pass(`installed files: ${files.length}, dist/ and sounds/ only`);
  else fail(`installed files differ.\n  expected ${expected.join(', ')}\n  got      ${files.join(', ')}`);

  const credits = fs.readFileSync(path.join(pkgDir, 'sounds', 'CREDITS.txt'), 'utf8');
  const recorded = /^sha256 ([0-9a-f]{64})$/m.exec(credits)?.[1];
  const actual = createHash('sha256').update(fs.readFileSync(path.join(pkgDir, 'sounds', 'boxing-bell.wav'))).digest('hex');
  if (recorded && recorded === actual) pass(`bell sha256 ${actual} matches CREDITS.txt`);
  else fail(`bell sha256 ${actual} does not match CREDITS.txt (${recorded ?? 'no sha256 line'})`);

  // 2. Every subpath loads and exports what this checkout's dist/ does.
  for (const m of MODULES) {
    const loaded = run(process.execPath, ['-e', `console.log(JSON.stringify(Object.keys(require('gym-tv-timer/${m}')).sort()))`], consumer);
    const want = JSON.stringify(Object.keys(rootRequire(`./dist/${m}.js`)).sort());
    const got = loaded.out.trim();
    if (loaded.status === 0 && got === want) pass(`require('gym-tv-timer/${m}'): ${JSON.parse(got).length} exports`);
    else fail(`require('gym-tv-timer/${m}') -> ${got || loaded.out}; expected ${want}`);
  }
  const bare = run(process.execPath, ['-e', "require('gym-tv-timer')"], consumer);
  if (bare.status !== 0 && bare.out.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')) pass("require('gym-tv-timer') is refused: there is no all-in-one entry");
  else fail("require('gym-tv-timer') did not refuse; an all-in-one entry would carry node:crypto into browser bundles");

  // 3. Browser-safe subpaths reach no Node module.
  for (const m of BROWSER_SAFE) {
    const source = fs.readFileSync(path.join(pkgDir, 'dist', `${m}.js`), 'utf8');
    const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map((match) => match[1]);
    const outside = requires.filter((r) => !BROWSER_SAFE.some((safe) => r === `./${safe}`));
    if (outside.length === 0) pass(`${m} is browser-safe (requires: ${requires.length ? requires.join(', ') : 'none'})`);
    else fail(`${m} requires ${outside.join(', ')}, which a browser bundle cannot take`);
  }

  // 4 and 5. Types and a test, configured as ppbf-platform's are.
  const typeRoots = [path.join(root, 'node_modules', '@types')];
  fs.writeFileSync(path.join(consumer, 'src', 'consumer.test.ts'), `
import { deriveRoundTimer, ROUND_TIMER_FIELDS, type RoundTimerRow, type RoundTimerView } from 'gym-tv-timer/roundTimers';
import { advanceRoundTimer, roundPanelText, type WallRoundReading } from 'gym-tv-timer/wallRoundTimer';
import { GYM_SAYINGS, type GymSaying } from 'gym-tv-timer/gymSayings';
import { PilotError } from 'gym-tv-timer/errors';
import { GymTvError, isWellFormedPairCode, newPairCode, normalizePairCode, validateTvName } from 'gym-tv-timer/gymTvs';
import { createOpaqueToken, hashToken } from 'gym-tv-timer/security';

const START = '2026-10-12T18:00:00.000Z';

test('every subpath works from a host', () => {
  const row: RoundTimerRow = {
    round_seconds: 180, rest_seconds: 60, rounds_total: 3, state: 'running',
    started_at: START, paused_at: null, paused_seconds: 0,
    server_time: new Date(Date.parse(START) + 10_000).toISOString(),
  };
  const view: RoundTimerView = deriveRoundTimer(row);
  expect(view).toMatchObject({ phase: 'work', round: 1, seconds_left: 170 });
  expect(Object.keys(view).sort()).toEqual([...ROUND_TIMER_FIELDS].sort());
  const reading: WallRoundReading = advanceRoundTimer(view, 5);
  expect(reading.seconds_left).toBe(165);
  expect(roundPanelText(reading, 180).label).toBe('Round 1 of 3');
  const sayings: readonly GymSaying[] = GYM_SAYINGS;
  expect(Array.isArray(sayings)).toBe(true);
  expect(isWellFormedPairCode(normalizePairCode(newPairCode().toLowerCase()))).toBe(true);
  expect(validateTvName(' Gym main ')).toBe('Gym main');
  expect(() => validateTvName('')).toThrow(GymTvError);
  expect(new GymTvError(400, 'TV_NAME_LENGTH')).toBeInstanceOf(PilotError);
  expect(hashToken(createOpaqueToken())).toMatch(/^[0-9a-f]{64}$/);
});
`);
  // apps/web/tsconfig.json's compiler options, minus the Next plugin, paths and incremental.
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      typeRoots,
      types: ['node', 'jest'],
    },
    include: ['src/**/*.ts'],
  }, null, 2));
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const bundler = run(process.execPath, [tsc, '-p', 'tsconfig.json'], consumer);
  if (bundler.status === 0) pass('types resolve under ppbf apps/web tsconfig (moduleResolution bundler)');
  else fail(`types under moduleResolution bundler:\n${bundler.out}`);
  const node10 = run(process.execPath, [tsc, '-p', 'tsconfig.json', '--module', 'commonjs', '--moduleResolution', 'node'], consumer);
  if (node10.status === 0) pass('types resolve under ppbf ts-jest override (module commonjs, moduleResolution node)');
  else fail(`types under moduleResolution node:\n${node10.out}`);

  // apps/web/jest.config.js's transform, verbatim in effect: ts-jest over the tsconfig above.
  fs.writeFileSync(path.join(consumer, 'jest.config.js'), `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\\\.tsx?$': [${JSON.stringify(rootRequire.resolve('ts-jest'))}, {
      tsconfig: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
    }],
  },
};
`);
  const jest = run(process.execPath, [path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), '--rootDir', consumer, '--ci'], consumer);
  if (jest.status === 0) pass('consumer test passes under ts-jest configured as ppbf-platform');
  else fail(`consumer test under ts-jest:\n${jest.out}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`\n${problems.length} drop-in problem(s).`);
  process.exit(1);
}
console.log('\ndrop-in check passed');
