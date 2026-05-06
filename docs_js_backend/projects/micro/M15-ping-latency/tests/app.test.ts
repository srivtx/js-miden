import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M15 Ping API", () => {
  it("GET /ping returns pong with timestamp", async () => {
    const res = await request(app).get("/ping").expect(200);
    expect(res.body.message).toBe("pong");
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it("GET /latency without target returns 400", async () => {
    await request(app).get("/latency").expect(400);
  });

  it("GET /latency blocks localhost", async () => {
    const res = await request(app)
      .get("/latency?target=localhost")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });

  it("GET /latency blocks 127.0.0.1", async () => {
    const res = await request(app)
      .get("/latency?target=127.0.0.1")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });

  it("GET /latency blocks private IP 192.168.1.1", async () => {
    const res = await request(app)
      .get("/latency?target=192.168.1.1")
      .expect(403);
    expect(res.body.error).toContain("blocked");
  });
});
