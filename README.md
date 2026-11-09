# gym-tv-timer

The pure logic behind a gym TV's round timer, as a TypeScript package: the round clock (work, rest, rounds, +30 SEC and REPEAT), the TV's bell and ten-second knock rules, TV pairing codes, token hashing, the gym's sayings, and the bell recording.

Extracted from [ppbf-platform at `4853120`](https://github.com/PunxsyProminence/ppbf-platform/commit/48531200c8fdf252bde696e4c9fda2db79a049fb). Code and comments are kept as written there; comments that mention the database, routes or screens describe the ppbf-platform code around these pieces.

**Storage and auth are supplied by the host app.** This package has no database, sign-in, session, organization or framework code. The host stores the timer row and the TV records, decides who may drive a timer, and passes rows in; the functions here only compute.

| Import | What it holds | Browser-safe |
| --- | --- | --- |
| `gym-tv-timer/roundTimers` | Timer types, limits, the allowlisted view fields, `deriveRoundTimer`, `adjustmentShift` | yes |
| `gym-tv-timer/wallRoundTimer` | The TV's count-on between reads, bell and knock sounds, panel text | yes |
| `gym-tv-timer/gymSayings` | The gym's own sayings | yes |
| `gym-tv-timer/errors` | `PilotError`, the base of `GymTvError` | yes |
| `gym-tv-timer/gymTvs` | Pairing-code constants and checks, TV name validation | no (`node:crypto`) |
| `gym-tv-timer/security` | Tokens, token hashes, PIN and password hashes | no (`node:crypto`) |
| `gym-tv-timer/sounds/boxing-bell.wav` | The bell; source, license and sha256 in `sounds/CREDITS.txt` | file |

There is no all-in-one `gym-tv-timer` import on purpose: it would carry `node:crypto` into a browser bundle. Client code may import types from any subpath (`import type`), and values only from the browser-safe ones.

## Using it from ppbf-platform

Add one line to `apps/web/package.json`, pinned to a full commit SHA of this repo, then `npm install` at the ppbf-platform root:

```json
"gym-tv-timer": "github:PunxsyProminence/gym-tv-timer#<full commit sha>"
```

npm fetches it as a GitHub tarball, so the Docker build needs no git (the build stage is `node:22-alpine`). npm skips its own integrity hash for git dependencies; the full SHA is what fixes the content. To update, change the SHA.

It ships compiled JavaScript and type files (`dist/`), so Next, Jest and `tsc` in ppbf-platform need no config change: types resolve under both `apps/web/tsconfig.json` (`moduleResolution: bundler`) and the ts-jest override in `apps/web/jest.config.js` (`moduleResolution: node`, through `typesVersions`).

Plug-back, file by file (the ppbf-platform file keeps its path, so no other import changes):

| ppbf-platform file | Becomes |
| --- | --- |
| `apps/web/components/wallRoundTimer.ts` | `export * from 'gym-tv-timer/wallRoundTimer';` |
| `apps/web/components/gymSayings.ts` | `export * from 'gym-tv-timer/gymSayings';` |
| `apps/web/src/server/pilot/security.ts` | `export * from 'gym-tv-timer/security';` |
| `apps/web/src/server/pilot/roundTimers.ts` | the database functions stay; the pure parts are deleted and re-exported from `gym-tv-timer/roundTimers` |
| `apps/web/src/server/pilot/gymTvs.ts` | the database functions stay; the pairing parts are deleted and re-exported from `gym-tv-timer/gymTvs` |
| `apps/web/src/server/pilot/errors.ts` | `PilotError` is deleted and re-exported from `gym-tv-timer/errors`, so there is one `PilotError` class: a `GymTvError` from this package must still be `instanceof` the class ppbf-platform's error handling checks, or its 400 turns into a 500 |
| `apps/web/public/sounds/boxing-bell.wav` | stays (Next serves `public/`); same bytes as `sounds/boxing-bell.wav` |

## Workout programs

`gym-tv-timer/workoutPrograms` (browser-safe, pure) describes a workout as ordered blocks of `rounds x work/rest` seconds, so a session can mix intervals (a warm-up, boxing rounds, a Tabata). `deriveProgramPosition(program, elapsedSeconds)` says which block, round and phase the room is in and the seconds left; `programTotalSeconds` and `singleBlockProgram` (today's round timer as one block) round it out. `validateWorkoutProgram(input)` checks anything a host loads or saves, never throws, and returns a trimmed copy or stable problem codes; limits are in `WORKOUT_PROGRAM_LIMITS`. The package stores nothing and holds no person, account or device id; how many programs a person may save is the host app's decision.

## Working on it

```bash
npm ci
npm run typecheck
npm test
npm run compile
npm run check:dropin
```

`dist/` is committed and CI fails when it does not match a fresh `npm run compile`. `check:dropin` installs the package into a throwaway project and checks the installed files, every import, the browser-safe ones, and the types and a test under ppbf-platform's TypeScript and ts-jest settings; `node scripts/check-dropin.mjs github:PunxsyProminence/gym-tv-timer#<sha>` runs the same checks against a pushed commit. It does not run a Next build.

The script is called `compile`, not `build`, on purpose: npm runs a full `npm install` (dev dependencies included) inside any git dependency that has a `build`, `prepare`, `prepack`, `preinstall`, `install` or `postinstall` script. `dist/` is committed, so nothing needs building at install time. Do not add a script with one of those names.

Node 22. No license has been chosen yet.
