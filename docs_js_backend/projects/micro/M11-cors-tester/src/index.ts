import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M11 CORS Tester running on http://localhost:${PORT}`);
});
