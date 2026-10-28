# gym-tv-timer

The pure logic behind a gym TV's round timer, as a TypeScript package: the round clock (work, rest, rounds, +30 SEC and REPEAT), the TV's bell and ten-second knock rules, TV pairing codes, token hashing, the gym's sayings, and the bell recording.

Extracted from [ppbf-platform at `4853120`](https://github.com/PunxsyProminence/ppbf-platform/commit/48531200c8fdf252bde696e4c9fda2db79a049fb). Code and comments are kept as written there; comments that mention the database, routes or screens describe the ppbf-platform code around these pieces.

**Storage and auth are supplied by the host app.** This package has no database, sign-in, session, organization or framework code. The host stores the timer row and the TV records, decides who may drive a timer, and passes rows in; the functions here only compute.

| File | What it holds |
| --- | --- |
| `src/roundTimers.ts` | Timer types, limits, the allowlisted view fields, `deriveRoundTimer`, `adjustmentShift` |
| `src/wallRoundTimer.ts` | The TV's count-on between reads, bell and knock sounds, panel text |
| `src/gymTvs.ts` | Pairing-code constants and checks, TV name validation |
| `src/errors.ts` | `PilotError`, the base of `GymTvError` |
| `src/security.ts` | Node `crypto` helpers: tokens, token hashes, PIN and password hashes |
| `src/gymSayings.ts` | The gym's own sayings |
| `sounds/boxing-bell.wav` | The bell; source, license and sha256 in `sounds/CREDITS.txt` |

```bash
npm ci
npm run typecheck
npm test
```

Node 22. No license has been chosen yet.
