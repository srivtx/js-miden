# v2 — Adding TypeScript

You just debugged why a file download returned garbage.

```js
const buffer = fs.readFileSync(`./uploads/${req.params.filename}`);
res.send(buffer);
```

Someone uploaded a file with `filename: undefined`. Your code tried to read `./uploads/undefined`. Node threw an error. But because you had no types, the error happened deep in the stack and was confusing.

## The Fix: Types

```ts
interface UploadBody {
  filename: string;
  file: string; // base64
}

app.post('/upload', (req: Request, res: Response) => {
  const { filename, file } = req.body as UploadBody;
  // TypeScript catches missing fields at compile time
});
```

## But Wait...

TypeScript doesn't validate at runtime. A client can still send `{ "filename": "../../../etc/passwd" }` and your code will try to write outside the uploads directory.

Also, your URLs are still permanent. No expiry. No tracking.

**Next:** Let's add validation and tokens.
