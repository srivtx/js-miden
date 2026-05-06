const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function encodeBase62(num: bigint): string {
  if (num === 0n) return '0';
  let result = '';
  const base = 62n;
  let n = num;
  while (n > 0n) {
    result = BASE62[Number(n % base)] + result;
    n = n / base;
  }
  return result;
}

export function decodeBase62(str: string): bigint {
  let result = 0n;
  const base = 62n;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BigInt(BASE62.indexOf(char));
    result = result * base + value;
  }
  return result;
}
