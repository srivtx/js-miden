# Problem Statement

Design and implement a secure, multi-language code execution engine that serves as the backend for competitive programming platforms (LeetCode, HackerRank) and online REPL environments (Repl.it, CodePen). The system must accept arbitrary user-submitted source code, execute it inside an isolated sandbox, enforce strict time and memory limits, capture stdout/stderr, and evaluate results against a suite of hidden test cases using precise diff comparison.

## Functional Requirements

1. **Multi-Language Support**: Stubs for JavaScript (Node.js), Python 3, and Go 1.22.
2. **Sandboxed Execution**: Docker-based isolation stub demonstrating seccomp, namespaces, and cgroups concepts.
3. **Resource Governance**: Per-submission CPU time limits (e.g., 2s) and memory limits (e.g., 256MB).
4. **Output Capture**: Stream-based collection of stdout and stderr with configurable encoding.
5. **Test Case Runner**: Execute code against multiple input/output pairs and produce a line-level diff report.
6. **HTTP API**: Express 5 endpoints for submission, status polling, and result retrieval.

## Non-Functional Requirements

- **Security**: Untrusted code must not affect the host or other submissions.
- **Availability**: A single malicious submission (e.g., infinite loop) must not crash the service.
- **Observability**: Structured logging of sandbox lifecycle events.

## Known Defect (Intentional Bug)

The output capture module accumulates all streamed stdout/stderr chunks into an unbounded in-memory string. There is no maximum output size check. A submission containing `while (true) { console.log('x'); }` will eventually exhaust the Node.js heap, causing an out-of-memory crash and denial-of-service for the entire worker process.

## Context

This project sits at the intersection of systems programming and web backend engineering. It requires understanding of Linux kernel security primitives, container runtimes, stream backpressure, process management, and algorithmic diffing. The intentional bug mimics real-world incidents where unbounded output buffers led to service degradation.
