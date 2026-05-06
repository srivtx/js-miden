# Architectural Decisions

## ADR-001: HLS over DASH as Primary Protocol

**Decision**: Implement HLS as the primary streaming protocol, with DASH as secondary.

**Rationale**: HLS has broader device support (iOS, Safari, Smart TVs). DASH is more flexible but less universally supported.

## ADR-002: Segment-based Storage

**Decision**: Store each quality variant in its own directory with segment files.

**Rationale**: Segments are immutable and cache-friendly. Allows independent quality switching.

## ADR-003: FFmpeg Worker Stub

**Decision**: Create a transcoding service stub that documents FFmpeg integration points.

**Rationale**: Actual FFmpeg execution requires careful process management and resource limits. In a curriculum project, the architecture and integration points are more educational than the binary execution.

## ADR-004: In-Memory Stores for Curriculum

**Decision**: Use in-memory Maps for video metadata, upload sessions, and watch history.

**Rationale**: Simplifies setup for students. Production would use PostgreSQL + Redis.

## ADR-005: ESM with TypeScript

**Decision**: Use ES Modules with .js extensions in imports.

**Rationale**: Aligns with Node.js best practices and Express 5 ESM support.
