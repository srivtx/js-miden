/**
 * BUG: Predictable UUID Generation
 *
 * This buggy implementation uses Math.random() instead of crypto.randomUUID().
 * Math.random() is NOT cryptographically secure and produces predictable values.
 * An attacker who observes a few UUIDs could predict future UUIDs, leading to:
 * - Session hijacking (if UUIDs are used as session tokens)
 * - Information leakage (predictable resource identifiers)
 * - Security token guessing
 *
 * Additionally, the validation regex is too permissive and accepts invalid formats.
 */

function buggyGenerateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const BUGGY_UUID_REGEX = /^[0-9a-f-]{36}$/i;

function buggyIsValidUUID(uuid: string): boolean {
  return BUGGY_UUID_REGEX.test(uuid);
}

// Demonstration
console.log("Buggy UUID:", buggyGenerateUUID());
console.log("Invalid UUID accepted?", buggyIsValidUUID("gggggggg-gggg-gggg-gggg-gggggggggggg"));
