# Architecture Decisions

## ADR-001: Docker as the Sandboxing Layer
- **Status**: Accepted
- **Context**: We need language-agnostic isolation that works for JavaScript, Python, and Go.
- **Decision**: Use Docker containers with custom seccomp profiles and cgroup limits. The `dockerode` library stubs the container lifecycle.
- **Consequences**: Requires Docker daemon access. Adds 100-500ms cold start per submission unless warm pools are introduced later.

## ADR-002: Modular Service Architecture
- **Status**: Accepted
- **Context**: Monolithic route handlers are impossible to unit test and lock us into a single backend.
- **Decision**: Decompose into `executor`, `sandbox`, `language`, `outputCapture`, and `testRunner` services with pure TypeScript interfaces.
- **Consequences**: Clear boundaries, testable in isolation, but introduces more files and indirection.

## ADR-003: In-Memory Output Capture with Streams
- **Status**: Accepted (with known defect)
- **Context**: We need to capture stdout/stderr from spawned processes.
- **Decision**: Attach `data` event listeners to `Readable` streams and accumulate chunks into a single string.
- **Consequences**: Simple API, but unbounded memory growth when processes emit excessive output. This is the intentional bug.

## ADR-004: LCS Diff Algorithm
- **Status**: Accepted
- **Context**: Test case failures need line-level diffs for user feedback.
- **Decision**: Implement Longest Common Subsequence (LCS) in TypeScript rather than importing a library.
- **Consequences**: O(n*m) time complexity. Acceptable for small test outputs (<1000 lines) but becomes a CPU bottleneck for massive diffs.

## ADR-005: TypeScript + ESM
- **Status**: Accepted
- **Context**: Type safety and modern module resolution reduce runtime errors.
- **Decision**: Use TypeScript 5.6 with `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`.
- **Consequences**: Requires `tsx` for development or a build step for production. All imports must include `.js` extensions.

## ADR-006: Pluggable Execution Strategy
- **Status**: Accepted
- **Context**: Synchronous HTTP is convenient for tests; async queues are required for scale.
- **Decision**: The `executor` service accepts a strategy interface. The default strategy is synchronous spawn; a queue-based strategy can be injected later.
- **Consequences**: No message queue dependency today, but the architecture is ready for BullMQ or RabbitMQ.
