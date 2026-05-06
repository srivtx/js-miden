import express, { Request, Response } from "express";
import { isValidRedirectUrl } from "./validator.js";

export const app = express();
app.use(express.json());

app.post("/redirect", (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url in request body" });
    return;
  }

  if (!isValidRedirectUrl(url)) {
    res.status(400).json({ error: "Invalid or unsafe URL" });
    return;
  }

  // Use 302 for temporary redirect
  res.redirect(302, url);
});

app.get("/info", (req: Request, res: Response) => {
  res.json({
    headers: req.headers,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M16 Simple Redirector running on port ${PORT}`);
  });
}
