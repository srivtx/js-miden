# Security

## Input Validation

Job payloads are stored as JSONB. Validate expected fields before enqueuing to prevent workers from crashing on malformed data.

## File Path Security

When processing video paths, ensure:
- Paths are within allowed directories (prevent directory traversal)
- Input files exist and are readable
- Output paths do not overwrite system files

## Resource Limits

- Worker concurrency is limited to prevent CPU exhaustion
- `ffmpeg` processes should have CPU and memory limits (use `cgroups` or Docker limits)

## Queue Security

Redis should be secured:
- Require AUTH password
- Bind to internal network only
- Enable TLS if crossing network boundaries
