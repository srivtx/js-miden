import express, { Request, Response } from "express";
import { generateUUID, isValidUUID } from "./uuid.js";

export const app = express();
app.use(express.json());

app.post("/generate", (_req: Request, res: Response) => {
  const uuid = generateUUID();
  res.json({ uuid });
});

app.get("/validate/:uuid", (req: Request, res: Response) => {
  const { uuid } = req.params;
  const valid = isValidUUID(uuid);
  res.json({ uuid, valid });
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M14 UUID Generator running on port ${PORT}`);
  });
}
