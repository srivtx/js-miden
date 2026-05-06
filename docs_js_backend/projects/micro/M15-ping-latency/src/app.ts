import express, { Request, Response } from "express";
import { measureLatency } from "./latency.js";

export const app = express();

app.get("/ping", (_req: Request, res: Response) => {
  res.json({ message: "pong", timestamp: new Date().toISOString() });
});

app.get("/latency", async (req: Request, res: Response) => {
  const target = req.query.target as string;

  if (!target || typeof target !== "string") {
    res.status(400).json({ error: "Missing target query parameter" });
    return;
  }

  try {
    const result = await measureLatency(target);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(403).json({ error: message });
  }
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M15 Ping API running on port ${PORT}`);
  });
}
