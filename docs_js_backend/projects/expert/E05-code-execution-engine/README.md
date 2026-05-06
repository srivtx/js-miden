# E05 Code Execution Engine

Expert-level secure code execution backend. Supports sandboxed execution (Docker stub), multiple languages, time/memory limits, output capture, and test-case diffing.

## Bug
No output size limits — an infinite loop printing to stdout causes memory exhaustion / DoS.

## Scripts
- `npm run dev` — development with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — run production build
- `npm run test` — run Vitest suite

## Architecture
- `src/routes/execution.ts` — HTTP API
- `src/services/executor.ts` — orchestration
- `src/services/sandbox.ts` — Docker-based isolation stub
- `src/services/language.ts` — language runners (JS, Python, Go stubs)
- `src/services/outputCapture.ts` — stdout/stderr capture (contains bug)
- `src/services/testRunner.ts` — diff-based test evaluation
- `src/utils/diff.ts` — line-level diff utility
