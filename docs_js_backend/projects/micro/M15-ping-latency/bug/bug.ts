/**
 * BUG: SSRF Vulnerability + Command Injection
 *
 * This buggy implementation has TWO critical security flaws:
 *
 * 1. SSRF (Server-Side Request Forgery):
 *    The code does NOT validate the target before pinging.
 *    An attacker can ping internal IPs like:
 *    - localhost / 127.0.0.1
 *    - 192.168.x.x (internal services)
 *    - 10.0.0.x (cloud metadata services like AWS 169.254.169.254)
 *    This allows attackers to scan internal networks and access services
 *    that should not be reachable from the outside.
 *
 * 2. Command Injection:
 *    The code passes user input directly to child_process.exec()
 *    without sanitization. An attacker can inject arbitrary commands:
 *    target=google.com; cat /etc/passwd
 *    target=google.com && rm -rf /
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function buggyMeasureLatency(target: string): Promise<string> {
  // DANGER: No input sanitization!
  const { stdout } = await execAsync(`ping -c 1 ${target}`);
  return stdout;
}

// Example attack payloads:
// ?target=localhost;curl http://169.254.169.254/latest/meta-data/
// ?target=google.com;cat /etc/passwd
console.log("BUG: No SSRF protection + command injection via child_process.exec");
