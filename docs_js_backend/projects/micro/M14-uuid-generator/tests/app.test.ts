import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M14 UUID Generator", () => {
  it("POST /generate returns a valid UUID v4", async () => {
    const res = await request(app).post("/generate").expect(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("GET /validate/:uuid returns true for valid UUID", async () => {
    const res = await request(app)
      .get("/validate/550e8400-e29b-41d4-a716-446655440000")
      .expect(200);
    expect(res.body.valid).toBe(true);
  });

  it("GET /validate/:uuid returns false for invalid UUID", async () => {
    const res = await request(app)
      .get("/validate/not-a-uuid")
      .expect(200);
    expect(res.body.valid).toBe(false);
  });

  it("GET /validate/:uuid returns false for wrong version", async () => {
    const res = await request(app)
      .get("/validate/550e8400-e29b-11d4-a716-446655440000")
      .expect(200);
    expect(res.body.valid).toBe(false);
  });
});
