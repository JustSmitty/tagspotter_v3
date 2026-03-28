# AGENTS.md

## Verification Commands
- Use `npm.cmd run lint` for lint checks on Windows.
- Use `npm.cmd run test -- --watch=false --browsers=ChromeHeadless` for the full Angular/Karma test suite.
- Use `npm.cmd run build` for the production Angular build.

## Notes
- In the Codex desktop sandbox on Windows, `npm.cmd run test -- --watch=false --browsers=ChromeHeadless` may fail with `spawn EPERM` unless Chrome is allowed to launch outside the sandbox.
- In the same environment, `npm.cmd run build` may also need elevated execution when the Angular compiler/optimizer hits the same `spawn EPERM` boundary.
- Recent correctness coverage is concentrated in `src/app/home/home.page.spec.ts`, `src/app/services/game-state.store.spec.ts`, `src/app/shared/quiz-modal/quiz-modal.component.spec.ts`, and `src/app/services/achievement.service.spec.ts`.
