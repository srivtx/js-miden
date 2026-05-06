# v1 — The Naive Code Runner (Pure JS)

You want to let users run code snippets. You build the simplest possible evaluator.

```js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/run', (req, res) => {
  const { code } = req.body;
  
  try {
    const output = [];
    const originalLog = console.log;
    console.log = (...args) => output.push(args.join(' '));
    
    const result = eval(code); // eslint-disable-line
    
    console.log = originalLog;
    res.json({ result, output });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(5000, () => console.log('Code runner on 5000'));
```

Send code. Get output. Done.

## Then the Pain Hits

**eval() is a loaded gun.** A user sends:
```js
require('child_process').exec('rm -rf /')
```
Your server deletes itself. Or worse, it joins a botnet.

**No resource limits.** A user sends `while (true) {}`. The event loop blocks forever. No other requests are served. Denial of service.

**No memory limits.** A user allocates a 4GB array. The process is killed by the OS. All running submissions die.

**No output limits.** A user runs `while (true) { console.log('x') }`. Output grows unbounded until the server runs out of memory and crashes.

**No isolation.** One submission reads another's files. A user finds `../../etc/passwd` in the working directory. Data leaks.

## The Realization

`eval()` is fine for a local REPL. For a production code execution engine, you need:
1. **Sandboxing** — isolate untrusted code from the host
2. **Resource limits** — CPU time, memory, output size
3. **Containerization** — Docker with namespaces and cgroups
4. **Monitoring** — track every execution, detect abuse
5. **Multi-language support** — JS, Python, Go, not just Node

This is where the evolution starts.
