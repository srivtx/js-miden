import { Request, Response } from "express";
import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

function isBlockedIP(ip: string): boolean {
  if (BLOCKED_HOSTS.has(ip)) return true;
  return BLOCKED_RANGES.some((range) => range.test(ip));
}

function isBlockedHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  return false;
}

export async function measureLatency(
  target: string
): Promise<{ host: string; ip: string; latencyMs: number }> {
  // Strip port if present for host validation
  const host = target.split(":")[0];

  if (isBlockedHost(host)) {
    throw new Error("Access to internal hosts is blocked");
  }

  // Resolve DNS
  const dnsStart = performance.now();
  const addresses = await lookup(host);
  const dnsTime = performance.now() - dnsStart;

  const ip = addresses.address;
  if (isBlockedIP(ip)) {
    throw new Error("Access to internal IPs is blocked");
  }

  // Measure TCP connection latency (port 80)
  const port = Number(target.split(":")[1]) || 80;
  const tcpStart = performance.now();

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    }, 5000);

    socket.connect(port, ip, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const tcpTime = performance.now() - tcpStart;

  return {
    host,
    ip,
    latencyMs: Math.round(dnsTime + tcpTime),
  };
}
