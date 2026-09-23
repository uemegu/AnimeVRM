# ardy-mini motion quality: implementation handoff

This folder is the low-cost-AI handoff for the motion-quality work. The core implementation is now in the repository; do not start again from task 01 or replace working code just to match the original design notes. First inspect the code and tests below. Implement only a concrete missing item, keep the contact geometry deterministic, and send API keys only from Node.

## Give this prompt to a low-cost coding AI

```text
Read plans/ardy-motion-quality/README.md and the relevant task note before editing.
The current implementation is already in src/ai/motion/quality/, scripts/lib/jev-motion-plan.ts,
scripts/ardy-generate.ts, and scripts/ardy-calibrate.ts. Contact correction is baked into the
generated FBX, so do not add a game-runtime solver unless the user asks for one.
Do not rewrite completed parts. Inspect the current files and tests first.
Work only on the remaining gap the user names. Preserve user changes in unrelated files.
Use Vite's default port unless the user requests another port. The quality tests themselves do not start a server.
Run `npx tsc --noEmit`, `npx playwright test --config playwright.quality.config.ts`,
and `node scripts/ardy-generate.ts --help` after code changes. Do not lower quality thresholds
to make tests pass. Do not claim live Jev or visual-avatar verification unless it was actually run.
Report changed files, checks run, and any remaining manual review in Japanese.
```

## Implemented pieces

| Area | Code | Current verification |
|---|---|---|
| Typed motion plan, avatar profile validation, pose/contact measurements | `src/ai/motion/quality/{types,validate,rig,measure}.ts` | Synthetic VRM skeleton tests |
| Face-touch and palms-together two-bone IK; non-accumulating contact easing | `solveContacts.ts`, `polishClip.ts` | Reach, elbow-side, repeat-seek and source-pose tests |
| VRM-to-Mixamo conversion, FBX export/reload gate | `normalizedClipToMixamo.ts`, `verifyRoundTrip.ts`, `cliRunner.ts` | In-memory round-trip metrics; 2-second ardy-mini/WebGPU FBX smoke generation succeeded |
| Multi-question Jev planner | `scripts/lib/jev-motion-plan.ts` | Mock tests plus 27 live Jev API classification requests; no Jev-plus-contact-quality FBX was run |
| Avatar-specific calibration | `quality-calibrate.html`, `calibrate.ts`, `scripts/ardy-calibrate.ts` | Production build includes the calibration page; each profile still needs a person to click and inspect the model |
| CLI | `scripts/ardy-generate.ts` | 2-second FBX generation succeeded using the Vite default (5173 was occupied, so Vite selected 5174) |

## Next work that needs a person or external credentials

1. Calibrate each actual VRM once: `npm run ardy:calibrate -- --avatar /models/aoi/aoi-school.vrm --output public/motion-profiles/aoi-school.json`. Click and inspect all five face/chest anchors and both palms; a profile is marked calibrated only after all seven points are recorded.
2. If Jev is enabled, set `JEV_API_KEY` in the shell or a local `.env` (`TYPESAFE_API_KEY` remains a fallback name). Jev is called once per motion request with nine independent Choice/Score questions. A cheek contact records the moving hand side and cheek side separately. Low confidence or unspecified required face details stops generation; uncertain timing and style strength use documented defaults. The key remains on Node and is not included in browser arguments or output files.
3. A Jev-authored timing plan is always `needs-review`. Inspect the generated `.review.fbx` and `.quality.json`; edit and save a reviewed plan with `timingSource: "authored"` before treating it as final.
4. The ardy-mini/WebGPU smoke generation succeeds. Quality generation still needs a visually calibrated real VRM profile. Confirm an Aoi/Emili contact result, its FBX reload measurements, and the baked FBX in the game's existing importer before tuning thresholds or style values.

Example generation:

```sh
npm run ardy:generate -- \
  -p "A person gently touches their left cheek, pauses, and lowers their hand." \
  -d 4 --jev --acting-note "soft, compact elbow path, restrained and brief" \
  --avatar /models/aoi/aoi-school.vrm \
  --contact-profile public/motion-profiles/aoi-school.json \
  -o public/animations/aoi-cheek.fbx
```

Or give the CLI a reviewed JSON plan using `--quality-plan`. `--format raw` cannot be combined with quality correction. A passed output writes the final FBX plus `.quality.json` and `.source.saved-motion.json`. The FBX already contains the contact correction and is played by the game as an ordinary animation; there is no runtime sidecar or game code change. A review-required output is written as `.review.fbx` and `.quality.json`; it does not overwrite the requested final path. Failed quality checks write the report and source motion but no final motion asset.

## Task notes

These files preserve the original small-task design for future targeted changes. The current implementation is the source of truth if a note differs.

| Task | Note | State |
|---|---|---|
| 01 | [Plan types and measurement](01-contract-and-measurement.md) | Implemented; synthetic tests pass |
| 02 | [Contact solver and avatar profile](02-contact-solver.md) | Implemented; real profile calibration is a manual per-avatar step |
| 03 | [CLI and export](03-cli-and-export.md) | 2-second ardy-mini FBX smoke passed; contact-quality FBX and visual acceptance remain |
| 04 | [Jev planner](04-jev-planner.md) | Implemented; 27 live calls classified; combined Jev plus calibrated contact-quality FBX remains |
| 05 | [Acting style](05-style.md) | Implemented as a compact elbow path plus smoother transition; visual tune remains |
| 06 | [Scenario runtime and acceptance](06-runtime-and-acceptance.md) | Runtime solver is out of scope; verify the baked FBX in the existing game importer |

`public/models/test.vrm` was already an untracked user file. Do not modify, delete, or add it to commits.
