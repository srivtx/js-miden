# Bugs & Failure Modes

## Bug E05-001: Unbounded Output Buffer (Critical)

### Description
`src/services/outputCapture.ts` listens to the `data` event of a child process stdout stream and appends each chunk to a JavaScript string:

```ts
let output = '';
stream.on('data', (chunk) => {
  output += chunk.toString();
});
```

There is no check on `output.length` or `Buffer.byteLength(output)`. A malicious submission such as:

```js
while (true) {
  console.log('A'.repeat(1024));
}
```

will write gigabytes of data. Because string concatenation in V8 allocates new backing store memory each time, the process heap grows until the OS OOM killer terminates the Node.js worker. This is a Denial-of-Service (DoS) vector affecting all concurrent submissions on that worker.

### Impact
- **Availability**: Complete worker crash. All in-flight submissions are lost.
- **Integrity**: None (process dies before data corruption).
- **Confidentiality**: None.

### Root Cause
- Missing output size cap.
- Missing backpressure handling on the stream.
- Missing periodic kill signal when output exceeds a threshold.
- The `outputCapture` service is pure with no side effects other than accumulation, so there is no circuit breaker.

### Fix
1. Introduce `MAX_OUTPUT_BYTES` environment variable (e.g., 1 MiB).
2. In the `data` event handler, check `Buffer.byteLength(output) + chunk.length`.
3. If exceeded, destroy the stream (`stream.destroy()`), kill the child with `SIGKILL`, and return an `OutputLimitExceeded` error to the user.
4. Consider using a `PassThrough` stream with a `transform` that enforces the limit, or a ring buffer for partial output retention.
5. Add metrics: `output.bytes.total`, `output.bytes.dropped`.

### Related CWEs
- CWE-400: Uncontrolled Resource Consumption
- CWE-770: Allocation of Resources Without Limits or Throttling
