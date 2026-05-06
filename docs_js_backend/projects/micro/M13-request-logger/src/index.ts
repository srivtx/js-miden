import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M13 Request Logger running on http://localhost:${PORT}`);
});
