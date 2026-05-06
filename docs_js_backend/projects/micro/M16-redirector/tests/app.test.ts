import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M16 Simple Redirector", () => {
  it("POST /redirect returns 302 for valid HTTP URL", async () => {
    await request(app)
      .post("/redirect")
      .send({ url: "https://example.com" })
      .expect(302)
      .expect("Location", "https://example.com");
  });

  it("POST /redirect rejects javascript: URLs", async () => {
    const res = await request(app)
      .post("/redirect")
      .send({ url: "javascript:alert('xss')" })
      .expect(400);
    expect(res.body.error).toBe("Invalid or unsafe URL");
  });

  it("POST /redirect rejects data: URLs", async () => {
    const res = await request(app)
      .post("/redirect")
      .send({ url: "data:text/html,<script>alert(1)</script>" })
      .expect(400);
    expect(res.body.error).toBe("Invalid or unsafe URL");
  });

  it("POST /redirect rejects missing url", async () => {
    const res = await request(app).post("/redirect").send({}).expect(400);
    expect(res.body.error).toBe("Missing url in request body");
  });

  it("GET /info returns request headers", async () => {
    const res = await request(app)
      .get("/info")
      .set("X-Custom-Header", "test")
      .expect(200);
    expect(res.body.headers["x-custom-header"]).toBe("test");
    expect(res.body.method).toBe("GET");
  });
});
